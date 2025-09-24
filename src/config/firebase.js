// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// Your Firebase configuration
// IMPORTANT: Replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "your-auth-domain",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "your-storage-bucket",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Auth functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Store user data in Firestore
    await createUserDocument(user);
    
    return { success: true, user };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return { success: false, error: error.message };
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await updateLastLogin(result.user.uid);
    return { success: true, user: result.user };
  } catch (error) {
    console.error("Error signing in:", error);
    return { success: false, error: error.message };
  }
};

export const signUpWithEmail = async (email, password, displayName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with display name
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    
    // Create user document in Firestore
    await createUserDocument(result.user);
    
    return { success: true, user: result.user };
  } catch (error) {
    console.error("Error signing up:", error);
    return { success: false, error: error.message };
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { success: false, error: error.message };
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error signing out:", error);
    return { success: false, error: error.message };
  }
};

// Firestore functions
const createUserDocument = async (user) => {
  if (!user) return;
  
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  
  if (!snapshot.exists()) {
    const { displayName, email, photoURL } = user;
    
    try {
      await setDoc(userRef, {
        displayName: displayName || '',
        email,
        photoURL: photoURL || '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        processedStatements: 0,
        subscription: 'free', // You can implement subscription tiers
        settings: {
          exportMode: 'combined',
          aiEnhancement: false,
          debugMode: false
        }
      });
    } catch (error) {
      console.error("Error creating user document:", error);
    }
  }
};

const updateLastLogin = async (userId) => {
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Error updating last login:", error);
  }
};

export default app;
