/**
 * SheGuard - Authentication Service
 * Manages Firebase Auth sessions, user registration, profile synchronization, and password recovery.
 */
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  getIdToken
} from './firebase.js';
import { api } from './api.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.authListeners = [];
    this.isInitialized = false;

    if (auth) {
      onAuthStateChanged(auth, async (user) => {
        this.currentUser = user;
        if (user) {
          try {
            await this.loadUserProfile();
          } catch (e) {
            console.warn('[SheGuard Auth] Could not fetch remote profile:', e);
          }
        } else {
          this.userProfile = null;
        }
        this.isInitialized = true;
        this.notifyListeners();
      });
    } else {
      this.isInitialized = true;
    }
  }

  /**
   * Registers a listener for authentication state changes
   */
  onAuthChange(callback) {
    this.authListeners.push(callback);
    if (this.isInitialized) {
      callback(this.currentUser, this.userProfile);
    }
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.authListeners.forEach(cb => {
      try {
        cb(this.currentUser, this.userProfile);
      } catch (err) {
        console.error('[SheGuard Auth] Listener error:', err);
      }
    });
  }

  /**
   * Waits for initial Firebase auth state to resolve
   */
  async waitForAuth() {
    if (this.isInitialized) return this.currentUser;
    return new Promise((resolve) => {
      const unsubscribe = this.onAuthChange((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * Register new user account
   */
  async register(email, password, displayName, phoneNumber = '') {
    if (!auth) throw new Error('Firebase Auth is not initialized. Please configure credentials.');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase display name
    await updateProfile(user, { displayName });

    // Send verification email
    try {
      await sendEmailVerification(user);
    } catch (e) {
      console.warn('[SheGuard Auth] Verification email could not be sent:', e);
    }

    // Register or synchronize user profile on backend
    try {
      await api.post('/profile', {
        displayName,
        phoneNumber,
        email
      });
    } catch (e) {
      console.warn('[SheGuard Auth] Backend profile sync postponed until backend connection:', e.message);
    }

    return user;
  }

  /**
   * Sign in with Email and Password
   */
  async login(email, password) {
    if (!auth) throw new Error('Firebase Auth is not initialized. Please configure credentials.');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    this.currentUser = userCredential.user;
    await this.loadUserProfile();
    return this.currentUser;
  }

  /**
   * Sign out current user
   */
  async logout() {
    if (!auth) return;
    await signOut(auth);
    this.currentUser = null;
    this.userProfile = null;
  }

  /**
   * Send Password Reset Email
   */
  async resetPassword(email) {
    if (!auth) throw new Error('Firebase Auth is not initialized.');
    return sendPasswordResetEmail(auth, email);
  }

  /**
   * Resend Email Verification
   */
  async resendVerification() {
    if (!this.currentUser) throw new Error('No user is currently logged in.');
    return sendEmailVerification(this.currentUser);
  }

  /**
   * Loads full profile from backend
   */
  async loadUserProfile() {
    if (!this.currentUser) return null;
    try {
      const profile = await api.get('/profile');
      this.userProfile = profile;
      return profile;
    } catch (err) {
      // Backend may be offline or unconfigured, fallback to basic Firebase user object
      this.userProfile = {
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        displayName: this.currentUser.displayName || 'User',
        emailVerified: this.currentUser.emailVerified,
        roles: ['USER']
      };
      return this.userProfile;
    }
  }

  /**
   * Checks if current user has ADMIN role
   */
  isAdmin() {
    if (!this.userProfile) return false;
    const roles = this.userProfile.roles || [];
    return roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
  }

  /**
   * Converts Firebase auth error codes to friendly messages
   */
  mapAuthError(error) {
    const code = error.code || '';
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please log in.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Access temporarily locked due to multiple failed login attempts. Please try again later or reset your password.';
      case 'auth/network-request-failed':
        return 'Network connection failed. Please check your internet connection.';
      default:
        return error.message || 'An unexpected authentication error occurred.';
    }
  }
}

export const authService = new AuthService();
