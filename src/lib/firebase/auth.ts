import { getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { BreweryProcess, BreweryWorker, UserRole } from '../../types/brewery';
import {
  OperationType,
  auth,
  db,
  firebaseConfig,
  handleFirestoreError,
} from './client';

// Verbatim blueprint constraints synchronized with firebase-blueprint.json & firestore.rules
export const EMPLOYEE_EMAIL_DOMAIN = 'sulsul.brewery';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'joonwn@gmail.com';
export const WORKER_ID_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_PHONE_LENGTH = 30;

const SECONDARY_APP_NAME = 'worker-admin-provisioner';

let pendingRegistrationPromise: Promise<unknown> | null = null;
const inFlightEnsureProfile = new Map<string, Promise<FirestoreUserProfile>>();

export interface FirestoreUserProfile {
  uid: string;
  workerId: string;
  displayName: string;
  email: string;
  phone: string;
  process: BreweryProcess;
  role: UserRole;
  isFirstLogin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterWorkerInput {
  workerId: string;
  password: string;
  displayName: string;
  process: BreweryProcess;
  phone?: string;
}

export interface ProvisionWorkerInput {
  workerId: string;
  initialPassword: string;
  displayName: string;
  process: BreweryProcess;
  phone?: string;
  role: UserRole;
}

function getSecondaryAuth() {
  const existingApp = getApps().find(a => a.name === SECONDARY_APP_NAME);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  return getAuth(secondaryApp);
}

function formatTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString().replace('T', ' ').substring(0, 19);
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export function normalizeWorkerId(raw: string): string {
  return raw.trim();
}

export function isValidWorkerId(raw: string): boolean {
  return WORKER_ID_PATTERN.test(normalizeWorkerId(raw));
}

export function workerIdToEmail(workerId: string): string {
  const normalized = normalizeWorkerId(workerId).toLowerCase();
  return `${normalized}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

export function emailToWorkerId(email?: string | null, fallbackUid?: string): string {
  if (email) {
    const trimmed = email.trim().toLowerCase();
    const suffix = `@${EMPLOYEE_EMAIL_DOMAIN}`;
    if (trimmed.endsWith(suffix)) {
      const local = trimmed.slice(0, -suffix.length).toUpperCase();
      if (WORKER_ID_PATTERN.test(local)) {
        return local;
      }
    }
    const localPart = trimmed.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    if (localPart && localPart.length >= 2) {
      return localPart.toUpperCase();
    }
  }
  const uidPart = (fallbackUid || 'USER').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12).toUpperCase();
  return uidPart.length >= 2 ? uidPart : 'EMP01';
}

export function isBootstrappedAdminUser(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL);
}

export function isPasswordAuthUser(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some(provider => provider.providerId === 'password');
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '사번 또는 비밀번호가 올바르지 않습니다. 등록된 사번과 비밀번호를 다시 확인해 주세요.';
    case 'auth/email-already-in-use':
      return '이미 등록된 사번입니다. 로그인 탭에서 사번과 비밀번호로 로그인해 주세요.';
    case 'auth/weak-password':
      return `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상으로 설정해야 합니다.`;
    case 'auth/invalid-email':
      return '사번 형식이 올바르지 않습니다. 영문, 숫자, 하이픈(-), 밑줄(_)만 2~32자로 입력해 주세요.';
    case 'auth/operation-not-allowed':
      return 'Firebase 콘솔에서 이메일/비밀번호 로그인이 활성화되어 있는지 확인해 주세요.';
    case 'auth/too-many-requests':
      return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해 주세요. 공장 Wi-Fi 또는 모바일 데이터를 점검해 주세요.';
    case 'auth/popup-closed-by-user':
      return 'Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.';
    case 'auth/popup-blocked':
      return '브라우저에서 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인한 뒤 비밀번호를 변경해 주세요.';
    default: {
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return '인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
}

function parseUserProfileDoc(uid: string, data: Record<string, unknown>): FirestoreUserProfile {
  const validProcesses: BreweryProcess[] = [
    'MALTING',
    'MASHING',
    'FERMENTATION',
    'FILTRATION',
    'REFINING',
    'BOTTLING',
    'OTHER',
  ];
  const validRoles: UserRole[] = ['WORKER', 'ADMIN', 'MAINTENANCE'];

  const rawProcess = String(data.process || 'OTHER') as BreweryProcess;
  const rawRole = String(data.role || 'WORKER') as UserRole;

  return {
    uid: typeof data.uid === 'string' && data.uid ? data.uid : uid,
    workerId:
      typeof data.workerId === 'string' && data.workerId
        ? data.workerId
        : emailToWorkerId(typeof data.email === 'string' ? data.email : null, uid),
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
        : '현장 직원',
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    process: validProcesses.includes(rawProcess) ? rawProcess : 'OTHER',
    role: validRoles.includes(rawRole) ? rawRole : 'WORKER',
    isFirstLogin: typeof data.isFirstLogin === 'boolean' ? data.isFirstLogin : false,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
}

export function mapProfileToBreweryWorker(
  profile: FirestoreUserProfile,
  suggestionCount = 0
): BreweryWorker {
  return {
    id: profile.workerId,
    name: profile.displayName,
    process: profile.process,
    role: profile.role,
    phone: profile.phone || '-',
    isFirstLogin: profile.isFirstLogin,
    suggestionCount,
  };
}

/**
 * 사번 + 비밀번호로 Firebase Email/Password 로그인
 */
export async function signInWithWorkerId(workerId: string, password: string): Promise<User> {
  const normalized = normalizeWorkerId(workerId);
  if (!isValidWorkerId(normalized)) {
    throw new Error('사번은 영문, 숫자, 하이픈(-), 밑줄(_) 조합 2~32자로 입력해 주세요.');
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
  }

  const email = workerIdToEmail(normalized);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * 신규 현장 직원 자가 등록 (Firebase Auth 계정 생성 + Firestore /users/{uid} 프로필 저장)
 */
export async function registerWorkerAccount(
  input: RegisterWorkerInput
): Promise<{ user: User; profile: FirestoreUserProfile }> {
  const normalizedId = normalizeWorkerId(input.workerId).toUpperCase();
  if (!isValidWorkerId(normalizedId)) {
    throw new Error('사번은 영문, 숫자, 하이픈(-), 밑줄(_) 조합 2~32자로 입력해 주세요.');
  }
  const cleanName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!cleanName) {
    throw new Error('성명(또는 이름/직급)을 입력해 주세요.');
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }

  const email = workerIdToEmail(normalizedId);
  const cleanPhone = (input.phone || '').trim().slice(0, MAX_PHONE_LENGTH);

  const task = (async () => {
    const credential = await createUserWithEmailAndPassword(auth, email, input.password);
    const user = credential.user;

    try {
      await updateProfile(user, { displayName: cleanName });
    } catch (err) {
      console.warn('Display name profile update warning:', err);
    }

    const docPath = `users/${user.uid}`;
    const payload = {
      uid: user.uid,
      workerId: normalizedId,
      displayName: cleanName,
      email: user.email || email,
      phone: cleanPhone,
      process: input.process,
      role: 'WORKER' as UserRole,
      isFirstLogin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', user.uid), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return {
      user,
      profile: {
        uid: user.uid,
        workerId: normalizedId,
        displayName: cleanName,
        email: user.email || email,
        phone: cleanPhone,
        process: input.process,
        role: 'WORKER' as UserRole,
        isFirstLogin: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
    };
  })();

  pendingRegistrationPromise = task;
  try {
    return await task;
  } finally {
    if (pendingRegistrationPromise === task) {
      pendingRegistrationPromise = null;
    }
  }
}

/**
 * 단일 사용자 Firestore 프로필 조회
 */
export async function getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
  const docPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return parseUserProfileDoc(uid, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

/**
 * 로그인된 사용자의 /users/{uid} 문서 보장 (최초 Google 로그인 또는 콘솔 직접 생성 계정 대비)
 */
export async function ensureUserProfile(user: User): Promise<FirestoreUserProfile> {
  const existing = await getUserProfile(user.uid);
  if (existing) {
    // Bootstrapped admin account should always have ADMIN role reflected in profile
    if (isBootstrappedAdminUser(user) && existing.role !== 'ADMIN') {
      const docPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: 'ADMIN',
          updatedAt: serverTimestamp(),
        });
        return { ...existing, role: 'ADMIN' };
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    }
    return existing;
  }

  const isSuperAdmin = isBootstrappedAdminUser(user);
  const derivedWorkerId = isSuperAdmin
    ? 'ADMIN01'
    : emailToWorkerId(user.email, user.uid);
  const derivedName = (
    user.displayName?.trim() ||
    (isSuperAdmin ? '시스템 관리자' : `직원 ${derivedWorkerId}`)
  ).slice(0, MAX_DISPLAY_NAME_LENGTH);
  const resolvedEmail = (user.email || workerIdToEmail(derivedWorkerId)).toLowerCase();
  const resolvedRole: UserRole = isSuperAdmin ? 'ADMIN' : 'WORKER';

  const docPath = `users/${user.uid}`;
  const payload = {
    uid: user.uid,
    workerId: derivedWorkerId,
    displayName: derivedName,
    email: resolvedEmail,
    phone: '',
    process: 'OTHER' as BreweryProcess,
    role: resolvedRole,
    isFirstLogin: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', user.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  return {
    uid: user.uid,
    workerId: derivedWorkerId,
    displayName: derivedName,
    email: resolvedEmail,
    phone: '',
    process: 'OTHER',
    role: resolvedRole,
    isFirstLogin: false,
    createdAt: nowStr,
    updatedAt: nowStr,
  };
}

/**
 * F-01 비밀번호 변경 (현재 비밀번호 재인증 -> 새 비밀번호 변경 -> isFirstLogin: false 기록)
 */
export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('로그인된 사번 계정을 찾을 수 없습니다.');
  }
  if (!isPasswordAuthUser(user)) {
    throw new Error('Google 로그인 계정은 Google 계정 설정에서 비밀번호를 변경해 주세요.');
  }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  if (currentPassword === newPassword) {
    throw new Error('새 비밀번호는 현재 비밀번호와 다르게 설정해 주세요.');
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);

  const docPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      isFirstLogin: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * 관리자 전용: 현재 관리자 세션을 유지한 채 실제 직원의 사번+초기비밀번호 계정 발급
 * (보조 Firebase App 인스턴스를 사용하여 관리자 로그아웃 방지)
 */
export async function provisionWorkerAccountByAdmin(
  input: ProvisionWorkerInput
): Promise<FirestoreUserProfile> {
  const adminUser = auth.currentUser;
  if (!adminUser) {
    throw new Error('관리자 인증 상태가 아닙니다.');
  }

  const normalizedId = normalizeWorkerId(input.workerId).toUpperCase();
  if (!isValidWorkerId(normalizedId)) {
    throw new Error('사번은 영문, 숫자, 하이픈(-), 밑줄(_) 조합 2~32자로 입력해 주세요.');
  }
  const cleanName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!cleanName) {
    throw new Error('직원 성명/직급을 입력해 주세요.');
  }
  if (!input.initialPassword || input.initialPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`초기 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }

  const email = workerIdToEmail(normalizedId);
  const cleanPhone = (input.phone || '').trim().slice(0, MAX_PHONE_LENGTH);

  const secondaryAuth = getSecondaryAuth();
  let createdUid = '';
  let createdEmail = email;

  try {
    const createdCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      input.initialPassword
    );
    createdUid = createdCredential.user.uid;
    createdEmail = createdCredential.user.email || email;

    try {
      await updateProfile(createdCredential.user, { displayName: cleanName });
    } catch (err) {
      console.warn('Secondary displayName update warning:', err);
    }
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }

  const userDocPath = `users/${createdUid}`;
  const payload = {
    uid: createdUid,
    workerId: normalizedId,
    displayName: cleanName,
    email: createdEmail,
    phone: cleanPhone,
    process: input.process,
    role: input.role,
    isFirstLogin: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', createdUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userDocPath);
  }

  if (input.role === 'ADMIN' && isBootstrappedAdminUser(adminUser)) {
    const adminGrantPath = `admins/${createdUid}`;
    try {
      await setDoc(doc(db, 'admins', createdUid), {
        uid: createdUid,
        grantedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, adminGrantPath);
    }
  }

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  return {
    uid: createdUid,
    workerId: normalizedId,
    displayName: cleanName,
    email: createdEmail,
    phone: cleanPhone,
    process: input.process,
    role: input.role,
    isFirstLogin: true,
    createdAt: nowStr,
    updatedAt: nowStr,
  };
}

/**
 * 관리자 전용: 등록된 직원의 공정/권한/연락처 정보 수정
 */
export async function updateWorkerByAdmin(
  targetUid: string,
  updates: {
    displayName?: string;
    process?: BreweryProcess;
    phone?: string;
    role?: UserRole;
  }
): Promise<void> {
  const adminUser = auth.currentUser;
  if (!adminUser) {
    throw new Error('관리자 인증 상태가 아닙니다.');
  }

  const userDocPath = `users/${targetUid}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.displayName !== undefined) {
    const trimmed = updates.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    if (trimmed) payload.displayName = trimmed;
  }
  if (updates.process !== undefined) {
    payload.process = updates.process;
  }
  if (updates.phone !== undefined) {
    payload.phone = updates.phone.trim().slice(0, MAX_PHONE_LENGTH);
  }
  if (updates.role !== undefined) {
    payload.role = updates.role;
  }

  try {
    await updateDoc(doc(db, 'users', targetUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userDocPath);
  }

  if (updates.role !== undefined && isBootstrappedAdminUser(adminUser)) {
    const adminGrantPath = `admins/${targetUid}`;
    try {
      if (updates.role === 'ADMIN') {
        await setDoc(doc(db, 'admins', targetUid), {
          uid: targetUid,
          grantedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', targetUid));
      }
    } catch (error) {
      handleFirestoreError(
        error,
        updates.role === 'ADMIN' ? OperationType.WRITE : OperationType.DELETE,
        adminGrantPath
      );
    }
  }
}

/**
 * 인증 사용자 프로필 실시간 구독
 * - 부트스트랩 관리자(Google): 전체 /users 컬렉션 구독 (Pillar 8 allow list 준수)
 * - 일반 직원: 본인 /users/{uid} 단일 문서 구독
 */
export function subscribeUserProfiles(
  user: User,
  onProfiles: (profiles: FirestoreUserProfile[]) => void,
  onCurrentProfile: (profile: FirestoreUserProfile | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (isBootstrappedAdminUser(user)) {
    const path = 'users';
    const q = query(collection(db, path));
    return onSnapshot(
      q,
      snapshot => {
        const list = snapshot.docs
          .map(docSnap => parseUserProfileDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => a.workerId.localeCompare(b.workerId));
        onProfiles(list);
        const self = list.find(p => p.uid === user.uid) || null;
        onCurrentProfile(self);
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          if (onError && wrapped instanceof Error) {
            onError(wrapped);
          }
        }
      }
    );
  }

  const docPath = `users/${user.uid}`;
  return onSnapshot(
    doc(db, 'users', user.uid),
    docSnap => {
      if (!docSnap.exists()) {
        onCurrentProfile(null);
        onProfiles([]);
        return;
      }
      const profile = parseUserProfileDoc(docSnap.id, docSnap.data());
      onCurrentProfile(profile);
      onProfiles([profile]);
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}
