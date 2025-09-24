// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
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

// Your Firebase configuration - ACTUAL VALUES
const firebaseConfig = {
  apiKey: "AIzaSyCdGqFfgjeq1T6PHDDoJkzUNh4iXLs0K8Y",
  authDomain: "pdfprocessor-29c6f.firebaseapp.com",
  projectId: "pdfprocessor-29c6f",
  storageBucket: "pdfprocessor-29c6f.firebasestorage.app",
  messagingSenderId: "949108932731",
  appId: "1:949108932731:web:8c3d76a228312ef246a2de",
  measurementId: "G-2RGFMT1WT0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (optional but good for tracking)
const analytics = getAnalytics(app);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Auth functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Store user data in Firestore
    await createUserDocument(user);
    
    // Log analytics event
    if (analytics) {
      // Track successful Google sign in
      console.log('User signed in with Google:', user.email);
    }
    
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
    
    // Log analytics event
    if (analytics) {
      console.log('User signed in with email:', email);
    }
    
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
    
    // Log analytics event
    if (analytics) {
      console.log('New user registered:', email);
    }
    
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
        monthlyQuota: 10, // Free tier gets 10 statements per month
        usedQuota: 0,
        settings: {
          exportMode: 'combined',
          aiEnhancement: false,
          debugMode: false,
          preferredOCRMode: 'standard'
        }
      });
      console.log('User document created successfully');
    } catch (error) {
      console.error("Error creating user document:", error);
    }
  } else {
    // Update last login for existing user
    await updateLastLogin(user.uid);
  }
};

const updateLastLogin = async (userId) => {
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, { 
      lastLogin: serverTimestamp() 
    }, { merge: true });
  } catch (error) {
    console.error("Error updating last login:", error);
  }
};

// Track statement processing (for quotas/history)
export const trackStatementProcessing = async (userId, statementData) => {
  const userRef = doc(db, 'users', userId);
  const historyRef = doc(db, 'users', userId, 'processingHistory', Date.now().toString());
  
  try {
    // Save processing history
    await setDoc(historyRef, {
      ...statementData,
      processedAt: serverTimestamp()
    });
    
    // Update user stats
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    await setDoc(userRef, {
      processedStatements: (userData.processedStatements || 0) + 1,
      usedQuota: (userData.usedQuota || 0) + 1,
      lastProcessed: serverTimestamp()
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error("Error tracking statement processing:", error);
    return { success: false, error: error.message };
  }
};

// Check user quota
export const checkUserQuota = async (userId) => {
  const userRef = doc(db, 'users', userId);
  
  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    const monthlyQuota = userData.monthlyQuota || 10;
    const usedQuota = userData.usedQuota || 0;
    const remaining = monthlyQuota - usedQuota;
    
    return {
      canProcess: remaining > 0,
      remaining,
      monthlyQuota,
      usedQuota,
      subscription: userData.subscription || 'free'
    };
  } catch (error) {
    console.error("Error checking quota:", error);
    return {
      canProcess: true, // Allow processing on error
      remaining: 10,
      monthlyQuota: 10,
      usedQuota: 0,
      subscription: 'free'
    };
  }
};

// Reset monthly quotas (you can run this via Cloud Functions monthly)
export const resetMonthlyQuotas = async () => {
  // This would typically be a Cloud Function that runs monthly
  // For now, we'll just have the logic here
  console.log('Monthly quota reset would happen here');
};

export { analytics };
export default app;
