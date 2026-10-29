import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Firestore,
} from "firebase/firestore";
import { WatchedMovie, MovieRecommendation } from "./movieLogic";

export interface FirebaseConfigValues {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

export const FIREBASE_CONFIG: FirebaseConfigValues = {
  apiKey:
    env.VITE_FIREBASE_API_KEY || "AIzaSyAlP2jA87fgySoM1_drTkX-qQBS0Cgj_dE",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "film-33a09.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "film-33a09",
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET || "film-33a09.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "879102956694",
  appId:
    env.VITE_FIREBASE_APP_ID || "1:879102956694:web:28cb3a6cadedd1abb2deb7",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.apiKey !== "MY_FIREBASE_API_KEY"
  );
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseServices(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!appInstance) {
    appInstance =
      getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
  }
  return {
    app: appInstance!,
    auth: authInstance!,
    db: dbInstance!,
  };
}

export interface CloudUserData {
  watchedMovies: WatchedMovie[];
  watchlist: MovieRecommendation[];
  tasteProfileSummary: string;
  updatedAt: string;
}

export async function signInWithGoogle(): Promise<User> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase är inte konfigurerat ännu.");
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(services.auth, provider);
  return result.user;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase är inte konfigurerat ännu.");
  }
  const result = await signInWithEmailAndPassword(
    services.auth,
    email.trim(),
    password
  );
  return result.user;
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<User> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase är inte konfigurerat ännu.");
  }
  const result = await createUserWithEmailAndPassword(
    services.auth,
    email.trim(),
    password
  );
  return result.user;
}

export async function logoutFirebaseUser(): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  await firebaseSignOut(services.auth);
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): () => void {
  const services = getFirebaseServices();
  if (!services) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(services.auth, callback);
}

export async function loadOrInitializeUserCloudData(
  uid: string,
  fallbackData: Omit<CloudUserData, "updatedAt">
): Promise<CloudUserData> {
  const services = getFirebaseServices();
  if (!services) {
    return { ...fallbackData, updatedAt: new Date().toISOString() };
  }
  const userDocRef = doc(services.db, "users", uid);
  const snap = await getDoc(userDocRef);
  if (snap.exists()) {
    const data = snap.data() as Partial<CloudUserData>;
    return {
      watchedMovies: Array.isArray(data.watchedMovies)
        ? data.watchedMovies
        : fallbackData.watchedMovies,
      watchlist: Array.isArray(data.watchlist)
        ? data.watchlist
        : fallbackData.watchlist,
      tasteProfileSummary:
        typeof data.tasteProfileSummary === "string" && data.tasteProfileSummary
          ? data.tasteProfileSummary
          : fallbackData.tasteProfileSummary,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } else {
    const initialPayload: CloudUserData = {
      ...fallbackData,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(userDocRef, initialPayload, { merge: true });
    return initialPayload;
  }
}

export async function saveUserCloudData(
  uid: string,
  data: Omit<CloudUserData, "updatedAt">
): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  const userDocRef = doc(services.db, "users", uid);
  const cleanPayload = JSON.parse(
    JSON.stringify({
      watchedMovies: data.watchedMovies,
      watchlist: data.watchlist,
      tasteProfileSummary: data.tasteProfileSummary,
      updatedAt: new Date().toISOString(),
    })
  );
  await setDoc(userDocRef, cleanPayload, { merge: true });
}

export function subscribeToUserCloudData(
  uid: string,
  onUpdate: (data: CloudUserData) => void
): () => void {
  const services = getFirebaseServices();
  if (!services) return () => {};
  const userDocRef = doc(services.db, "users", uid);
  return onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() as Partial<CloudUserData>;
    if (
      Array.isArray(data.watchedMovies) &&
      Array.isArray(data.watchlist) &&
      typeof data.tasteProfileSummary === "string"
    ) {
      onUpdate({
        watchedMovies: data.watchedMovies,
        watchlist: data.watchlist,
        tasteProfileSummary: data.tasteProfileSummary,
        updatedAt: data.updatedAt || "",
      });
    }
  });
}
