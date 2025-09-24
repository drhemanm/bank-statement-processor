// src/components/AuthComponent.js
import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  FileText,
  Eye,
  EyeOff,
  LogIn
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signInWithEmail, 
  signUpWithEmail, 
  resetPassword 
} from '../config/firebase';

const AuthComponent = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login'); // login, signup, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let result;
      
      if (mode === 'login') {
        result = await signInWithEmail(email, password);
        if (result.success) {
          onAuthSuccess && onAuthSuccess(result.user);
        } else {
          setError(result.error);
        }
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError("Passwords don't match");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        
        result = await signUpWithEmail(email, password, displayName);
        if (result.success) {
          onAuthSuccess && onAuthSuccess(result.user);
        } else {
          setError(result.error);
        }
      } else if (mode === 'reset') {
        result = await resetPassword(email);
        if (result.success) {
          setSuccess('Password reset email sent! Check your inbox.');
          setTimeout(() => setMode('login'), 3000);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        onAuthSuccess && onAuthSuccess(result.user);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to sign in with Google');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error) => {
    if (error.includes('user-not-found')) return 'No account found with this email';
    if (error.includes('wrong-password')) return 'Incorrect password';
    if (error.includes('email-already-in-use')) return 'Email is already registered';
    if (error.includes('invalid-email')) return 'Invalid email address';
    if (error.includes('weak-password')) return 'Password is too weak';
    return error;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white rounded-xl shadow-2xl p-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            MCB Statement Processor
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create a new account'}
            {mode === 'reset' && 'Reset your password'}
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
            <span className="text-sm text-red-800">{getErrorMessage(error)}</span>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
            <span className="text-sm text-green-800">{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                  required={mode === 'signup'}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm your password"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'reset' && 'Send Reset Email'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>

          {/* Google Sign In */}
          {mode !== 'reset' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </>
          )}
        </form>

        {/* Mode Switch Links */}
        <div className="text-center text-sm">
          {mode === 'login' && (
            <>
              <button
                onClick={() => setMode('reset')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Forgot password?
              </button>
              <div className="mt-2">
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sign up
                </button>
              </div>
            </>
          )}
          
          {mode === 'signup' && (
            <div>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Sign in
              </button>
            </div>
          )}
          
          {mode === 'reset' && (
            <div>
              Remember your password?{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthComponent;
