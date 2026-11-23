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
  PROCESS_ORDER,
  ROLE_ORDER,
  normalizeProcess,
  normalizeRole,
} from '../../data/mockBreweryData';
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
// 사번은 숫자 4자리 (예: 1455)
export const WORKER_ID_PATTERN = /^\d{4}$/;
export const MIN_PASSWORD_LENGTH = 4;
export const DEFAULT_INITIAL_PASSWORD = '1111';
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_PHONE_LENGTH = 30;

// Firebase Auth 최소 6자 제약에 대응하기 위한 결정론적 패스워드 래퍼 (4자리 이상 비밀번호 및 초기 비밀번호 '1111' 지원)
const FIREBASE_AUTH_PASSWORD_SUFFIX = '::sulsul-p2#';

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
  role?: Exclude<UserRole, 'ADMIN'>;
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
  return raw.replace(/\s+/g, '').trim();
}

export function isValidWorkerId(raw: string): boolean {
  return WORKER_ID_PATTERN.test(normalizeWorkerId(raw));
}

export function workerIdToEmail(workerId: string): string {
  const normalized = normalizeWorkerId(workerId).toLowerCase();
  return `${normalized}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

export function toFirebaseAuthPassword(rawPassword: string): string {
  return `${rawPassword}${FIREBASE_AUTH_PASSWORD_SUFFIX}`;
}

export function emailToWorkerId(email?: string | null, fallbackUid?: string): string {
  if (email) {
    const trimmed = email.trim().toLowerCase();
    const suffix = `@${EMPLOYEE_EMAIL_DOMAIN}`;
    if (trimmed.endsWith(suffix)) {
      const local = trimmed.slice(0, -suffix.length);
      if (/^[a-zA-Z0-9_-]{2,32}$/.test(local)) {
        return local.toUpperCase();
      }
    }
    const localPart = trimmed.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    if (localPart && localPart.length >= 2) {
      return localPart.toUpperCase();
    }
  }
  const uidPart = (fallbackUid || 'USER').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12).toUpperCase();
  return uidPart.length >= 2 ? uidPart : '0000';
}

export function isBootstrappedAdminUser(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL);
}

export function isPasswordAuthUser(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some(provider => provider.providerId === 'password');
}

function isInvalidCredentialError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  return (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  );
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
      return '사번 또는 비밀번호가 올바르지 않습니다. 숫자 4자리 사번과 비밀번호를 다시 확인해 주세요.';
    case 'auth/email-already-in-use':
      return '이미 등록된 사번입니다. 로그인 탭에서 사번과 비밀번호로 로그인해 주세요.';
    case 'auth/weak-password':
      return `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상으로 설정해야 합니다.`;
    case 'auth/invalid-email':
      return '사번 형식이 올바르지 않습니다. 숫자 4자리(예: 1455)로 입력해 주세요.';
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
    process: normalizeProcess(data.process),
    role: normalizeRole(data.role),
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
 * 사번(숫자 4자리) + 비밀번호(4자리 이상)로 Firebase Email/Password 로그인
 */
export async function signInWithWorkerId(workerId: string, password: string): Promise<User> {
  const normalized = normalizeWorkerId(workerId);
  if (!isValidWorkerId(normalized)) {
    throw new Error('사번은 숫자 4자리(예: 1455)로 입력해 주세요.');
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상 입력해 주세요.`);
  }

  const email = workerIdToEmail(normalized);
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      toFirebaseAuthPassword(password)
    );
    return credential.user;
  } catch (err) {
    // 기존 6자리 이상 원문 비밀번호로 생성된 계정과의 하위 호환 폴백
    if (isInvalidCredentialError(err) && password.length >= 6) {
      const legacyCredential = await signInWithEmailAndPassword(auth, email, password);
      return legacyCredential.user;
    }
    throw err;
  }
}

/**
 * 신규 현장 직원 자가 등록 (Firebase Auth 계정 생성 + Firestore /users/{uid} 프로필 저장)
 */
export async function registerWorkerAccount(
  input: RegisterWorkerInput
): Promise<{ user: User; profile: FirestoreUserProfile }> {
  const normalizedId = normalizeWorkerId(input.workerId);
  if (!isValidWorkerId(normalizedId)) {
    throw new Error('사번은 숫자 4자리(예: 1455)로 입력해 주세요.');
  }
  const cleanName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!cleanName) {
    throw new Error('성명(또는 이름/직급)을 입력해 주세요.');
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 합니다.`);
  }

  const email = workerIdToEmail(normalizedId);
  const cleanPhone = (input.phone || '').trim().slice(0, MAX_PHONE_LENGTH);
  const safeProcess = normalizeProcess(input.process);
  const safeRole: Exclude<UserRole, 'ADMIN'> =
    input.role === 'TEAM_LEADER' || input.role === 'PART_LEADER' ? input.role : 'WORKER';

  const task = (async () => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      toFirebaseAuthPassword(input.password)
    );
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
      process: safeProcess,
      role: safeRole as UserRole,
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
        process: safeProcess,
        role: safeRole as UserRole,
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
 * 로그인된 사용자의 /users/{uid} 문서 보장 및 레거시 공정/역할 자동 마이그레이션
 */
export async function ensureUserProfile(user: User): Promise<FirestoreUserProfile> {
  const existingTask = inFlightEnsureProfile.get(user.uid);
  if (existingTask) {
    return existingTask;
  }

  const task = (async (): Promise<FirestoreUserProfile> => {
    if (pendingRegistrationPromise) {
      await pendingRegistrationPromise.catch(() => {});
    }

    const docPath = `users/${user.uid}`;
    let rawSnapData: Record<string, unknown> | null = null;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        rawSnapData = snap.data();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }

    if (rawSnapData) {
      const parsed = parseUserProfileDoc(user.uid, rawSnapData);
      const isSuperAdmin = isBootstrappedAdminUser(user);
      const rawProcess = String(rawSnapData.process || '');
      const rawRole = String(rawSnapData.role || '');
      const hasLegacyProcess = !PROCESS_ORDER.includes(rawProcess as BreweryProcess);
      const hasLegacyRole = !ROLE_ORDER.includes(rawRole as UserRole);
      const needsAdminUpgrade = isSuperAdmin && parsed.role !== 'ADMIN';

      const migrationUpdates: Record<string, unknown> = {};
      if (hasLegacyProcess) {
        migrationUpdates.process = parsed.process;
      }
      if (needsAdminUpgrade) {
        migrationUpdates.role = 'ADMIN';
      } else if (hasLegacyRole && isSuperAdmin) {
        migrationUpdates.role = parsed.role;
      }

      if (Object.keys(migrationUpdates).length > 0) {
        migrationUpdates.updatedAt = serverTimestamp();
        try {
          await updateDoc(doc(db, 'users', user.uid), migrationUpdates);
          return {
            ...parsed,
            role: needsAdminUpgrade ? 'ADMIN' : parsed.role,
          };
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, docPath);
        }
      }
      return parsed;
    }

    const isSuperAdmin = isBootstrappedAdminUser(user);
    const derivedWorkerId = isSuperAdmin
      ? 'ADMIN01'
      : emailToWorkerId(user.email, user.uid);
    const derivedName = (
      user.displayName?.trim() ||
      (isSuperAdmin ? '허준원 관리자' : `직원 ${derivedWorkerId}`)
    ).slice(0, MAX_DISPLAY_NAME_LENGTH);
    const resolvedEmail = (user.email || workerIdToEmail(derivedWorkerId)).toLowerCase();
    const resolvedRole: UserRole = isSuperAdmin ? 'ADMIN' : 'WORKER';
    const defaultProcess: BreweryProcess = isSuperAdmin ? 'ADMIN' : 'RFC';

    const payload = {
      uid: user.uid,
      workerId: derivedWorkerId,
      displayName: derivedName,
      email: resolvedEmail,
      phone: '',
      process: defaultProcess,
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
      process: defaultProcess,
      role: resolvedRole,
      isFirstLogin: false,
      createdAt: nowStr,
      updatedAt: nowStr,
    };
  })();

  inFlightEnsureProfile.set(user.uid, task);
  try {
    return await task;
  } finally {
    if (inFlightEnsureProfile.get(user.uid) === task) {
      inFlightEnsureProfile.delete(user.uid);
    }
  }
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
    throw new Error(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 합니다.`);
  }
  if (currentPassword === newPassword) {
    throw new Error('새 비밀번호는 현재 비밀번호와 다르게 설정해 주세요.');
  }

  try {
    const wrappedCred = EmailAuthProvider.credential(
      user.email,
      toFirebaseAuthPassword(currentPassword)
    );
    await reauthenticateWithCredential(user, wrappedCred);
  } catch (err) {
    if (isInvalidCredentialError(err) && currentPassword.length >= 6) {
      const legacyCred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, legacyCred);
    } else {
      throw err;
    }
  }

  await updatePassword(user, toFirebaseAuthPassword(newPassword));

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
 * 관리자 전용: 현재 관리자 세션을 유지한 채 실제 직원의 사번(숫자 4자리)+초기비밀번호(기본 1111) 계정 발급
 */
export async function provisionWorkerAccountByAdmin(
  input: ProvisionWorkerInput
): Promise<FirestoreUserProfile> {
  const adminUser = auth.currentUser;
  if (!adminUser) {
    throw new Error('관리자 인증 상태가 아닙니다.');
  }

  const normalizedId = normalizeWorkerId(input.workerId);
  if (!isValidWorkerId(normalizedId)) {
    throw new Error('사번은 숫자 4자리(예: 1455)로 입력해 주세요.');
  }
  const cleanName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!cleanName) {
    throw new Error('직원 성명/직급을 입력해 주세요.');
  }
  if (!input.initialPassword || input.initialPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`초기 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 합니다.`);
  }

  const email = workerIdToEmail(normalizedId);
  const cleanPhone = (input.phone || '').trim().slice(0, MAX_PHONE_LENGTH);
  const safeProcess = normalizeProcess(input.process);
  const safeRole = normalizeRole(input.role);

  const secondaryAuth = getSecondaryAuth();
  let createdUid = '';
  let createdEmail = email;

  try {
    const createdCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      toFirebaseAuthPassword(input.initialPassword)
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
    process: safeProcess,
    role: safeRole,
    isFirstLogin: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', createdUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userDocPath);
  }

  if (safeRole === 'ADMIN' && isBootstrappedAdminUser(adminUser)) {
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
    process: safeProcess,
    role: safeRole,
    isFirstLogin: true,
    createdAt: nowStr,
    updatedAt: nowStr,
  };
}

/**
 * 관리자 전용: 등록된 직원의 담당 공정/직책(권한)/연락처 정보 수정
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
    payload.process = normalizeProcess(updates.process);
  }
  if (updates.phone !== undefined) {
    payload.phone = updates.phone.trim().slice(0, MAX_PHONE_LENGTH);
  }
  if (updates.role !== undefined) {
    payload.role = normalizeRole(updates.role);
  }

  try {
    await updateDoc(doc(db, 'users', targetUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userDocPath);
  }

  if (updates.role !== undefined && isBootstrappedAdminUser(adminUser)) {
    const adminGrantPath = `admins/${targetUid}`;
    try {
      const existingGrant = await getDoc(doc(db, 'admins', targetUid));
      if (updates.role === 'ADMIN') {
        if (!existingGrant.exists()) {
          await setDoc(doc(db, 'admins', targetUid), {
            uid: targetUid,
            grantedAt: serverTimestamp(),
          });
        }
      } else if (existingGrant.exists()) {
        await deleteDoc(doc(db, 'admins', targetUid));
      }
    } catch (error) {
      handleFirestoreError(
        error,
        updates.role === 'ADMIN' ? OperationType.CREATE : OperationType.DELETE,
        adminGrantPath
      );
    }
  }
}

export interface BulkProvisionItemInput {
  rowNumber: number;
  workerId: string;
  displayName: string;
  role: UserRole;
  process: BreweryProcess;
  phone?: string;
  existingUid?: string;
}

export interface BulkProvisionProgressItem {
  rowNumber: number;
  workerId: string;
  displayName: string;
  role: UserRole;
  process: BreweryProcess;
  phone: string;
  status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  message: string;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 관리자 전용: 여러 명의 직원 계정을 순차적으로 안전하게 일괄 발급/업데이트
 * - Firebase Auth 과도한 요청(rate-limit) 방지를 위해 순차 처리 + 짧은 간격 적용
 * - 이미 등록된 사번은 옵션에 따라 건너뛰기 또는 프로필 업데이트
 */
export async function bulkProvisionWorkersByAdmin(params: {
  items: BulkProvisionItemInput[];
  initialPassword: string;
  updateExisting: boolean;
  onItemProgress?: (
    itemResult: BulkProvisionProgressItem,
    completedCount: number,
    totalCount: number
  ) => void;
  shouldStop?: () => boolean;
}): Promise<BulkProvisionProgressItem[]> {
  const { items, initialPassword, updateExisting, onItemProgress, shouldStop } = params;
  const adminUser = auth.currentUser;
  if (!adminUser) {
    throw new Error('관리자 인증 상태가 아닙니다.');
  }
  if (!initialPassword || initialPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`초기 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 합니다.`);
  }

  const isSuperAdmin = isBootstrappedAdminUser(adminUser);
  const results: BulkProvisionProgressItem[] = [];

  for (let i = 0; i < items.length; i += 1) {
    if (shouldStop?.()) {
      break;
    }

    const item = items[i];
    const cleanPhone = (item.phone || '').trim().slice(0, MAX_PHONE_LENGTH);
    let outcome: BulkProvisionProgressItem;

    try {
      if (item.role === 'ADMIN' && !isSuperAdmin) {
        outcome = {
          rowNumber: item.rowNumber,
          workerId: item.workerId,
          displayName: item.displayName,
          role: item.role,
          process: item.process,
          phone: cleanPhone,
          status: 'FAILED',
          message: '관리자 권한 부여는 시스템 관리자(Google) 계정에서만 가능합니다.',
        };
      } else if (item.existingUid) {
        if (!updateExisting) {
          outcome = {
            rowNumber: item.rowNumber,
            workerId: item.workerId,
            displayName: item.displayName,
            role: item.role,
            process: item.process,
            phone: cleanPhone,
            status: 'SKIPPED',
            message: '이미 등록된 사번 (건너뜀)',
          };
        } else {
          await updateWorkerByAdmin(item.existingUid, {
            displayName: item.displayName,
            process: item.process,
            role: item.role,
            ...(cleanPhone ? { phone: cleanPhone } : {}),
          });
          outcome = {
            rowNumber: item.rowNumber,
            workerId: item.workerId,
            displayName: item.displayName,
            role: item.role,
            process: item.process,
            phone: cleanPhone,
            status: 'UPDATED',
            message: '기존 직원 직책·공정·성명 업데이트 완료',
          };
        }
      } else {
        await provisionWorkerAccountByAdmin({
          workerId: item.workerId,
          initialPassword,
          displayName: item.displayName,
          process: item.process,
          role: item.role,
          phone: cleanPhone,
        });
        outcome = {
          rowNumber: item.rowNumber,
          workerId: item.workerId,
          displayName: item.displayName,
          role: item.role,
          process: item.process,
          phone: cleanPhone,
          status: 'CREATED',
          message: `신규 발급 완료 (초기 비밀번호 ${initialPassword})`,
        };
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code || '';
      if (code === 'auth/email-already-in-use') {
        outcome = {
          rowNumber: item.rowNumber,
          workerId: item.workerId,
          displayName: item.displayName,
          role: item.role,
          process: item.process,
          phone: cleanPhone,
          status: 'SKIPPED',
          message: '이미 Firebase 인증에 등록된 사번 (건너뜀)',
        };
      } else {
        outcome = {
          rowNumber: item.rowNumber,
          workerId: item.workerId,
          displayName: item.displayName,
          role: item.role,
          process: item.process,
          phone: cleanPhone,
          status: 'FAILED',
          message: formatFirebaseAuthError(err),
        };
      }
    }

    results.push(outcome);
    onItemProgress?.(outcome, results.length, items.length);

    // Firebase Auth 연속 생성 시 rate-limit 방지용 짧은 대기
    if (i < items.length - 1 && outcome.status === 'CREATED') {
      await sleepMs(200);
    }
  }

  return results;
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
