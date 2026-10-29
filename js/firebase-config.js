/**
 * SheGuard - Firebase Client Configuration
 * Connected to live Firebase project: careerai-a4947
 */
export const firebaseConfig = (typeof window !== 'undefined' && window.SHEGUARD_FIREBASE_CONFIG) ? window.SHEGUARD_FIREBASE_CONFIG : {
  apiKey: "AIzaSyD7tZGL40KYyAYKhSBuVwLslfrYo2yTF_k",
  authDomain: "careerai-a4947.firebaseapp.com",
  projectId: "careerai-a4947",
  storageBucket: "careerai-a4947.firebasestorage.app",
  messagingSenderId: "142840093345",
  appId: "1:142840093345:web:ab49605bebf726c9cf6ee0",
  measurementId: "G-PY404WWEY9"
};

/**
 * Validates whether real Firebase credentials have been configured.
 */
export function isFirebaseConfigured() {
  return firebaseConfig && 
    firebaseConfig.apiKey && 
    !firebaseConfig.apiKey.includes('REPLACE_WITH_YOUR');
}
