/**
 * SheGuard - Modular Firebase Initialization
 * Uses official Firebase ES modules from Google CDN
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  getIdToken
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let app;
let auth;
let db;
let storage;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (!isFirebaseConfigured()) {
    console.warn(
      "[SheGuard] Firebase credentials not configured in js/firebase-config.js. " +
      "Authentication and live database operations require valid Firebase project keys."
    );
  }
} catch (err) {
  console.error("[SheGuard] Error initializing Firebase SDK:", err);
}

export {
  app,
  auth,
  db,
  storage,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  getIdToken,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  ref,
  uploadBytesResumable,
  getDownloadURL
};
