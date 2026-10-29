/**
 * SheGuard - Firebase Client Configuration
 * 
 * Replace placeholders below with your actual Firebase project settings
 * from the Firebase Console (Project Settings > General > Your apps > Web app)
 * or supply window.SHEGUARD_FIREBASE_CONFIG in your environment.
 */
export const firebaseConfig = (typeof window !== 'undefined' && window.SHEGUARD_FIREBASE_CONFIG) ? window.SHEGUARD_FIREBASE_CONFIG : {
  apiKey: "AIzaSy_REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "sheguard-safety.firebaseapp.com",
  projectId: "sheguard-safety",
  storageBucket: "sheguard-safety.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

/**
 * Validates whether real Firebase credentials have been configured.
 */
export function isFirebaseConfigured() {
  return firebaseConfig && 
    firebaseConfig.apiKey && 
    !firebaseConfig.apiKey.includes('REPLACE_WITH_YOUR');
}
