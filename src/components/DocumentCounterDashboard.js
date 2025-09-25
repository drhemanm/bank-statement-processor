// src/components/DocumentCounterDashboard.js
import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Award, 
  AlertCircle,
  Activity,
  BarChart3,
  RefreshCw,
  CheckCircle,
  History
} from 'lucide-react';
import { getUserDocumentStats, getProcessingHistory } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const DocumentCounterDashboard = ({ onProcessComplete }) => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load stats on mount and when user changes
  useEffect(() => {
    if (currentUser) {
      loadStats();
      loadHistory();
    }
  }, [currentUser]);

  // Refresh stats when a document is processed
  useEffect(() => {
    if (onProcessComplete) {
      loadStats();
      loadHistory();
    }
  }, [onProcessComplete]);

  const loadStats = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const result = await getUserDocumentStats(currentUser.uid);
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!currentUser) return;
    
    try {
      const result = await getProcessingHistory(currentUser.uid, 5);
      if (result.success) {
        setHistory(result.history);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadHistory()]);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const quotaPercentage = stats?.subscription === 'premium' 
    ? 100 
    : ((stats?.monthlyQuota - stats?.quotaRemaining) / stats?.monthlyQuota) * 100;

  const isNearQuotaLimit = stats?.subscription !== 'premium' && stats?.quotaRemaining <= 2;

  return (
    <div className="space-y-6">
      {/* Main Counter Dashboard */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-white" />
              <h2 className="text-xl font-bold text-white">Document Processing Dashboard</h2>
            </div>
            <button
              onClick={handleRefresh}
              className={`p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors ${
                refreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Counter Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Documents Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Documents</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">
                    {stats?.totalProcessed || 0}
                  </p>
                  <p className="text-xs text-purple-500 mt-1">All-time processed</p>
                </div>
                <div className="p-2 bg-purple-200 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Monthly Counter Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">This Month</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    {stats?.monthlyProcessed || 0}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    {stats?.subscription === 'premium' ? 'Unlimited' : `of ${stats?.monthlyQuota || 10}`}
                  </p>
                </div>
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Today's Counter Card */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Today</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">
                    {stats?.dailyProcessed || 0}
                  </p>
                  <p className="text-xs text-green-500 mt-1">Documents processed</p>
                </div>
                <div className="p-2 bg-green-200 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </div>

            {/* Quota Remaining Card */}
            <div className={`rounded-xl p-4 border ${
              isNearQuotaLimit 
                ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' 
                : 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    isNearQuotaLimit ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    Quota Remaining
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${
                    isNearQuotaLimit ? 'text-red-900' : 'text-yellow-900'
                  }`}>
                    {stats?.subscription === 'premium' ? '∞' : stats?.quotaRemaining || 0}
                  </p>
                  <p className={`text-xs mt-1 ${
                    isNearQuotaLimit ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {stats?.subscription === 'premium' ? 'Premium' : 'This month'}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${
                  isNearQuotaLimit ? 'bg-red-200' : 'bg-yellow-200'
                }`}>
                  {stats?.subscription === 'premium' ? (
                    <Award className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <TrendingUp className={`h-5 w-5 ${
                      isNearQuotaLimit ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quota Progress Bar */}
          {stats?.subscription !== 'premium' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Monthly Quota Usage</span>
                <span className="text-sm text-gray-500">
                  {stats?.monthlyProcessed || 0} / {stats?.monthlyQuota || 10}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    quotaPercentage >= 90 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : quotaPercentage >= 70 
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                  style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                />
              </div>
              {isNearQuotaLimit && (
                <div className="mt-2 flex items-center space-x-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Almost at monthly limit! Consider upgrading to Premium.</span>
                </div>
              )}
            </div>
          )}

          {/* Recent Documents */}
          {stats?.recentDocuments && stats.recentDocuments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  Recent Documents
                </h3>
                <span className="text-xs text-gray-500">Last 5 processed</span>
              </div>
              <div className="space-y-2">
                {stats.recentDocuments.map((doc, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 bg-blue-100 rounded">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.processedAt).toLocaleDateString()} • 
                          {doc.transactionCount} transactions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {doc.successRate}% success
                      </span>
                      <span className="text-xs text-gray-500">
                        {doc.processingMode}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-gray-600">
                  Account: <span className="font-medium text-gray-800">
                    {stats?.subscription === 'premium' ? 'Premium' : 'Free'}
                  </span>
                </span>
              </div>
              {stats?.lastProcessed && (
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-gray-600">
                    Last processed: <span className="font-medium text-gray-800">
                      {new Date(stats.lastProcessed.seconds * 1000).toLocaleDateString()}
                    </span>
                  </span>
                </div>
              )}
            </div>
            {stats?.subscription !== 'premium' && (
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Upgrade to Premium →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span className="font-medium">Quick Stats</span>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <span className="opacity-80">Avg. per day:</span>
              <span className="ml-1 font-bold">
                {stats?.dailyProcessed || 0}
              </span>
            </div>
            <div>
              <span className="opacity-80">This week:</span>
              <span className="ml-1 font-bold">
                {Math.min(stats?.monthlyProcessed || 0, 7 * (stats?.dailyProcessed || 0))}
              </span>
            </div>
            <div>
              <span className="opacity-80">Success rate:</span>
              <span className="ml-1 font-bold">95%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentCounterDashboard;
