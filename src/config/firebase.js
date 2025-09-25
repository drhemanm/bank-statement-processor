// src/config/firebase.js - Enhanced with document counter
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
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

// Your Firebase configuration
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
const analytics = getAnalytics(app);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// ============= DOCUMENT COUNTER FUNCTIONS =============

/**
 * Initialize or update user's document counters
 */
const initializeDocumentCounters = async (userId) => {
  const userRef = doc(db, 'users', userId);
  
  try {
    await updateDoc(userRef, {
      documentCounters: {
        totalProcessed: 0,
        monthlyProcessed: 0,
        dailyProcessed: 0,
        lastResetDate: serverTimestamp(),
        lastProcessedDate: null,
        documentHistory: []
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error initializing document counters:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Track document processing with comprehensive counters
 */
export const trackDocumentProcessing = async (userId, documentData) => {
  const userRef = doc(db, 'users', userId);
  const historyRef = doc(collection(db, 'users', userId, 'processingHistory'));
  
  try {
    // Get current user data
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    // Check if we need to reset daily/monthly counters
    const now = new Date();
    const lastProcessed = userData.documentCounters?.lastProcessedDate?.toDate();
    
    let updates = {
      'documentCounters.totalProcessed': increment(1),
      'documentCounters.lastProcessedDate': serverTimestamp(),
      processedStatements: increment(1),
      usedQuota: increment(1),
      lastProcessed: serverTimestamp()
    };
    
    // Reset daily counter if it's a new day
    if (!lastProcessed || lastProcessed.toDateString() !== now.toDateString()) {
      updates['documentCounters.dailyProcessed'] = 1;
    } else {
      updates['documentCounters.dailyProcessed'] = increment(1);
    }
    
    // Reset monthly counter if it's a new month
    if (!lastProcessed || lastProcessed.getMonth() !== now.getMonth() || 
        lastProcessed.getFullYear() !== now.getFullYear()) {
      updates['documentCounters.monthlyProcessed'] = 1;
      updates.usedQuota = 1; // Reset monthly quota
    } else {
      updates['documentCounters.monthlyProcessed'] = increment(1);
    }
    
    // Add to document history (keep last 100 entries)
    const newHistoryEntry = {
      fileName: documentData.fileName,
      processedAt: now.toISOString(),
      transactionCount: documentData.transactionCount || 0,
      successRate: documentData.successRate || 0,
      fileSize: documentData.fileSize || 0,
      processingMode: documentData.processingMode || 'OCR'
    };
    
    // Get existing history and update
    const existingHistory = userData.documentCounters?.documentHistory || [];
    const updatedHistory = [newHistoryEntry, ...existingHistory].slice(0, 100);
    updates['documentCounters.documentHistory'] = updatedHistory;
    
    // Update user document
    await updateDoc(userRef, updates);
    
    // Save detailed processing history
    await setDoc(historyRef, {
      ...documentData,
      processedAt: serverTimestamp(),
      userId: userId
    });
    
    // Return updated counters
    const updatedDoc = await getDoc(userRef);
    const updatedData = updatedDoc.data();
    
    return { 
      success: true,
      counters: {
        total: updatedData.documentCounters?.totalProcessed || 0,
        monthly: updatedData.documentCounters?.monthlyProcessed || 0,
        daily: updatedData.documentCounters?.dailyProcessed || 0,
        quotaRemaining: (updatedData.monthlyQuota || 10) - (updatedData.usedQuota || 0)
      }
    };
  } catch (error) {
    console.error("Error tracking document processing:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's document statistics
 */
export const getUserDocumentStats = async (userId) => {
  const userRef = doc(db, 'users', userId);
  
  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    
    return {
      success: true,
      stats: {
        totalProcessed: userData.documentCounters?.totalProcessed || userData.processedStatements || 0,
        monthlyProcessed: userData.documentCounters?.monthlyProcessed || userData.usedQuota || 0,
        dailyProcessed: userData.documentCounters?.dailyProcessed || 0,
        monthlyQuota: userData.monthlyQuota || 10,
        quotaRemaining: (userData.monthlyQuota || 10) - (userData.usedQuota || 0),
        subscription: userData.subscription || 'free',
        lastProcessed: userData.lastProcessed,
        recentDocuments: userData.documentCounters?.documentHistory?.slice(0, 5) || []
      }
    };
  } catch (error) {
    console.error("Error getting document stats:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get processing history for a user
 */
export const getProcessingHistory = async (userId, limitCount = 10) => {
  try {
    const historyRef = collection(db, 'users', userId, 'processingHistory');
    const q = query(
      historyRef, 
      orderBy('processedAt', 'desc'), 
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, history };
  } catch (error) {
    console.error("Error getting processing history:", error);
    return { success: false, error: error.message, history: [] };
  }
};

/**
 * Check if user can process more documents
 */
export const checkDocumentQuota = async (userId) => {
  const userRef = doc(db, 'users', userId);
  
  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    const monthlyQuota = userData.monthlyQuota || 10;
    const usedQuota = userData.usedQuota || 0;
    const remaining = monthlyQuota - usedQuota;
    const subscription = userData.subscription || 'free';
    
    // Premium users get unlimited
    if (subscription === 'premium') {
      return {
        canProcess: true,
        remaining: 'Unlimited',
        monthlyQuota: 'Unlimited',
        usedQuota: userData.documentCounters?.monthlyProcessed || 0,
        subscription: 'premium',
        dailyProcessed: userData.documentCounters?.dailyProcessed || 0,
        totalProcessed: userData.documentCounters?.totalProcessed || 0
      };
    }
    
    return {
      canProcess: remaining > 0,
      remaining,
      monthlyQuota,
      usedQuota,
      subscription,
      dailyProcessed: userData.documentCounters?.dailyProcessed || 0,
      totalProcessed: userData.documentCounters?.totalProcessed || 0
    };
  } catch (error) {
    console.error("Error checking document quota:", error);
    return {
      canProcess: true,
      remaining: 10,
      monthlyQuota: 10,
      usedQuota: 0,
      subscription: 'free',
      dailyProcessed: 0,
      totalProcessed: 0
    };
  }
};

// ============= ORIGINAL AUTH FUNCTIONS =============

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await createUserDocument(user);
    
    if (analytics) {
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
    
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    
    await createUserDocument(result.user);
    
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

// Enhanced createUserDocument with document counters
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
        subscription: 'free',
        monthlyQuota: 10,
        usedQuota: 0,
        // Add document counters
        documentCounters: {
          totalProcessed: 0,
          monthlyProcessed: 0,
          dailyProcessed: 0,
          lastResetDate: serverTimestamp(),
          lastProcessedDate: null,
          documentHistory: []
        },
        settings: {
          exportMode: 'combined',
          aiEnhancement: false,
          debugMode: false,
          preferredOCRMode: 'standard'
        }
      });
      console.log('User document created with counters');
    } catch (error) {
      console.error("Error creating user document:", error);
    }
  } else {
    // Update existing user with counters if they don't have them
    const userData = snapshot.data();
    if (!userData.documentCounters) {
      await initializeDocumentCounters(user.uid);
    }
    await updateLastLogin(user.uid);
  }
};

const updateLastLogin = async (userId) => {
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, { 
      lastLogin: serverTimestamp() 
    });
  } catch (error) {
    console.error("Error updating last login:", error);
  }
};

// Legacy function for backward compatibility
export const trackStatementProcessing = trackDocumentProcessing;
export const checkUserQuota = checkDocumentQuota;

// Monthly reset function (can be triggered by Cloud Function)
export const resetMonthlyQuotas = async () => {
  console.log('Monthly quota reset would happen here');
  // This would typically be implemented as a Cloud Function
};

export { analytics };
export default app;
