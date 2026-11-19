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

function pickEnvValue(
  nextPublicValue: string | undefined,
  viteValue: string | undefined,
  fallbackValue: string | undefined
): string {
  const trimmedNext = nextPublicValue?.trim();
  if (trimmedNext) return trimmedNext;

  const trimmedVite = viteValue?.trim();
  if (trimmedVite) return trimmedVite;

  return fallbackValue?.trim() || '';
}

/**
 * Firebase 설정 로드 (우선순위: NEXT_PUBLIC_FIREBASE_* -> VITE_FIREBASE_* -> firebase-applet-config.json)
 * 대상 프로젝트: sulsul-proposal-2
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    import.meta.env.VITE_FIREBASE_API_KEY,
    firebaseAppletConfig.apiKey
  ),
  authDomain: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    firebaseAppletConfig.authDomain
  ),
  projectId: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    firebaseAppletConfig.projectId
  ),
  storageBucket: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    firebaseAppletConfig.storageBucket
  ),
  messagingSenderId: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppletConfig.messagingSenderId
  ),
  appId: pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    import.meta.env.VITE_FIREBASE_APP_ID,
    firebaseAppletConfig.appId
  ),
  ...(pickEnvValue(
    import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    firebaseAppletConfig.measurementId
  )
    ? {
        measurementId: pickEnvValue(
          import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
          import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
          firebaseAppletConfig.measurementId
        ),
      }
    : {}),
};

export const firestoreDatabaseId: string = pickEnvValue(
  import.meta.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID,
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
  firebaseAppletConfig.firestoreDatabaseId
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
