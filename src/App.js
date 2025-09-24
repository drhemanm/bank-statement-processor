// src/App.js
import React, { useState, useEffect } from 'react';
import BankStatementProcessor from './BankStatementProcessor';
import AuthComponent from './components/AuthComponent';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { logOut } from './config/firebase';
import { LogOut, User, Loader2 } from 'lucide-react';
import './index.css';

// Main App Content Component
function AppContent() {
  const { currentUser, userProfile, loading, isAuthenticated } = useAuth();
  const [showProcessor, setShowProcessor] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setShowProcessor(true);
    } else {
      setShowProcessor(false);
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    const result = await logOut();
    if (result.success) {
      setShowProcessor(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <AuthComponent onAuthSuccess={() => setShowProcessor(true)} />;
  }

  // Authenticated - show processor with user info
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* User Header Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <User className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {currentUser?.displayName || currentUser?.email}
                </p>
                <p className="text-xs text-gray-500">
                  {userProfile?.subscription === 'premium' ? '⭐ Premium' : 'Free Account'}
                  {userProfile?.usedQuota !== undefined && userProfile?.monthlyQuota && 
                    ` • ${userProfile.monthlyQuota - userProfile.usedQuota} statements remaining`
                  }
                </p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main App */}
      <BankStatementProcessor />
    </div>
  );
}

// Root App Component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
