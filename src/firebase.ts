import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

const isConfigured = 
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_API_KEY !== "your_api_key" && 
  import.meta.env.VITE_FIREBASE_API_KEY !== "gen-lang-client-0984681318" && 
  import.meta.env.VITE_FIREBASE_API_KEY !== "";

const firebaseConfig = {
  apiKey: isConfigured ? import.meta.env.VITE_FIREBASE_API_KEY : "AIzaSy_MOCK_KEY_FOR_LOCAL_OFFLINE_MODE",
  authDomain: (isConfigured && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : "socialtalk-local-fallback.firebaseapp.com",
  projectId: (isConfigured && import.meta.env.VITE_FIREBASE_PROJECT_ID) ? import.meta.env.VITE_FIREBASE_PROJECT_ID : "socialtalk-local-fallback",
  storageBucket: (isConfigured && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : "socialtalk-local-fallback.appspot.com",
  messagingSenderId: (isConfigured && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : "000000000000",
  appId: (isConfigured && import.meta.env.VITE_FIREBASE_APP_ID) ? import.meta.env.VITE_FIREBASE_APP_ID : "1:000000000000:web:00000000000000000",
};

let app: any;
let db: any;
let auth: any;

try {
  app = initializeApp(firebaseConfig);
  // Ensure we do pass an undefined/null database ID if it is unconfigured/empty to avoid FirebaseError
  const dbId = import.meta.env.VITE_FIRESTORE_DATABASE_ID && import.meta.env.VITE_FIRESTORE_DATABASE_ID !== "your_database_id" && import.meta.env.VITE_FIRESTORE_DATABASE_ID !== "" 
    ? import.meta.env.VITE_FIRESTORE_DATABASE_ID 
    : undefined;
  db = getFirestore(app, dbId);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase initialization failed with current config. Setting up dummy fallback app:", e);
  const fallbackConfig = {
    apiKey: "AIzaSy_MOCK_KEY_FOR_LOCAL_OFFLINE_MODE",
    authDomain: "localhost",
    projectId: "socialtalk-dummy",
  };
  try {
    app = initializeApp(fallbackConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (err) {
    console.error("Critical: Could not initialize even fallback app:", err);
  }
}

export { db, auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged };
export type { User };

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

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
    userId: string | undefined;
    nickname: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, nickname?: string) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: nickname || 'anonymous',
      nickname: nickname || null,
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Handled (running in fallback/offline mode):', JSON.stringify(errInfo));
}
