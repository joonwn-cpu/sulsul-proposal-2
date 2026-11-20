import { FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../../firebase-applet-config.json';

// 프로젝트(sulsul-proposal-2) 검증 완료 기본 fallback 설정
// 주의: apiKey의 24번째 문자는 숫자 0이 아닌 영문 대문자 O (...gfeOjDf...)입니다.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA1h983c8nNc6YDgfeOjDfvNtZGZ_v6k6I',
  authDomain: 'sulsul-proposal-2.firebaseapp.com',
  projectId: 'sulsul-proposal-2',
  storageBucket: 'sulsul-proposal-2.firebasestorage.app',
  messagingSenderId: '711863169912',
  appId: '1:711863169912:web:b2d8afed0c027f69134e8d',
  firestoreDatabaseId: 'ai-studio-1cdd4bd9-bb3f-4e2e-9c69-cbe1ce7af92d',
} as const;

// 숫자 0 오타로 인해 auth/api-key-not-valid를 유발하는 키 패턴 자동 보정
const MISTYPED_API_KEY_WITH_ZERO = 'AIzaSyA1h983c8nNc6YDgfe0jDfvNtZGZ_v6k6I';

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return '';
  // Vercel 환경변수에 앞뒤 따옴표("..." / '...')나 공백이 포함된 경우 자동 제거
  const cleaned = value.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!cleaned) return '';
  // 예시 플레이스홀더 문자열이 그대로 들어간 경우 무시
  if (/^(YOUR_|MY_|REPLACE_|remixed-project-id)/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function pickEnvValue(
  nextPublicValue: string | undefined,
  viteValue: string | undefined,
  ...fallbacks: Array<string | undefined>
): string {
  const cleanedNext = normalizeEnvValue(nextPublicValue);
  if (cleanedNext) return cleanedNext;

  const cleanedVite = normalizeEnvValue(viteValue);
  if (cleanedVite) return cleanedVite;

  for (const fallback of fallbacks) {
    const cleanedFallback = normalizeEnvValue(fallback);
    if (cleanedFallback) return cleanedFallback;
  }

  return '';
}

function resolveApiKey(): string {
  const rawKey = pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    import.meta.env.VITE_FIREBASE_API_KEY,
    DEFAULT_FIREBASE_CONFIG.apiKey,
    firebaseAppletConfig.apiKey
  );
  if (rawKey === MISTYPED_API_KEY_WITH_ZERO) {
    return DEFAULT_FIREBASE_CONFIG.apiKey;
  }
  return rawKey;
}

const resolvedMeasurementId = pickEnvValue(
  import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firebaseAppletConfig.measurementId
);

/**
 * Firebase 설정 로드 (우선순위: NEXT_PUBLIC_FIREBASE_* -> VITE_FIREBASE_* -> 기본 fallback 설정)
 * 대상 프로젝트: sulsul-proposal-2
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: resolveApiKey(),
  authDomain: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    DEFAULT_FIREBASE_CONFIG.authDomain,
    firebaseAppletConfig.authDomain
  ),
  projectId: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    DEFAULT_FIREBASE_CONFIG.projectId,
    firebaseAppletConfig.projectId
  ),
  storageBucket: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    DEFAULT_FIREBASE_CONFIG.storageBucket,
    firebaseAppletConfig.storageBucket
  ),
  messagingSenderId: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    firebaseAppletConfig.messagingSenderId
  ),
  appId: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    import.meta.env.VITE_FIREBASE_APP_ID,
    DEFAULT_FIREBASE_CONFIG.appId,
    firebaseAppletConfig.appId
  ),
  ...(resolvedMeasurementId ? { measurementId: resolvedMeasurementId } : {}),
};

export const firestoreDatabaseId: string = pickEnvValue(
  import.meta.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID,
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
  firebaseAppletConfig.firestoreDatabaseId,
  DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId
);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

// 중복 초기화 방지 (Next.js / Vite 공용 패턴)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 지정된 Firestore 데이터베이스 ID가 있으면 해당 DB 인스턴스로 연결
export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
