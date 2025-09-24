import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Eye, EyeOff, FileText, Calendar, DollarSign, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

const EnhancedResultsDisplay = ({ results, uncategorizedData, fileStats }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showUncategorizedDetails, setShowUncategorizedDetails] = useState(true);
  const [uncategorizedViewMode, setUncategorizedViewMode] = useState('list');
  const [selectedFile, setSelectedFile] = useState('all');

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Calculate comprehensive statistics
  const calculateStats = () => {
    const stats = {
      totalTransactions: 0,
      categorizedCount: 0,
      uncategorizedCount: uncategorizedData.length,
      totalDebits: 0,
      totalCredits: 0,
      openingBalance: 0,
      closingBalance: 0,
      categorySummary: {}
    };

    // Calculate categorized transactions
    Object.entries(results).forEach(([category, transactions]) => {
      stats.totalTransactions += transactions.length;
      stats.categorizedCount += transactions.length;
      
      const categoryDebits = transactions.filter(t => t.isDebit).reduce((sum, t) => sum + t.amount, 0);
      const categoryCredits = transactions.filter(t => !t.isDebit).reduce((sum, t) => sum + t.amount, 0);
      
      stats.totalDebits += categoryDebits;
      stats.totalCredits += categoryCredits;
      
      stats.categorySummary[category] = {
        count: transactions.length,
        debits: categoryDebits,
        credits: categoryCredits,
        total: categoryDebits + categoryCredits
      };
    });

    // Add uncategorized to total
    stats.totalTransactions += uncategorizedData.length;
    const uncategorizedDebits = uncategorizedData.filter(t => t.isDebit).reduce((sum, t) => sum + t.amount, 0);
    const uncategorizedCredits = uncategorizedData.filter(t => !t.isDebit).reduce((sum, t) => sum + t.amount, 0);
    stats.totalDebits += uncategorizedDebits;
    stats.totalCredits += uncategorizedCredits;

    // Calculate balances from fileStats
    Object.values(fileStats).forEach(fileStat => {
      if (fileStat.metadata) {
        stats.openingBalance += fileStat.metadata.openingBalance || 0;
        stats.closingBalance += fileStat.metadata.closingBalance || 0;
      }
    });

    return stats;
  };

  const stats = calculateStats();
  const successRate = stats.totalTransactions > 0 
    ? ((stats.categorizedCount / stats.totalTransactions) * 100).toFixed(1) 
    : 0;

  // Get unique files for filtering
  const allFiles = new Set();
  Object.values(results).flat().forEach(t => allFiles.add(t.sourceFile));
  uncategorizedData.forEach(t => allFiles.add(t.sourceFile));

  // Filter transactions by selected file
  const filterByFile = (transactions) => {
    if (selectedFile === 'all') return transactions;
    return transactions.filter(t => t.sourceFile === selectedFile);
  };

  // Group uncategorized by source file
  const uncategorizedByFile = uncategorizedData.reduce((acc, transaction) => {
    const file = transaction.sourceFile || 'Unknown File';
    if (!acc[file]) acc[file] = [];
    acc[file].push(transaction);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Main Statistics Card */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Processing Results</h2>
          
          {/* File Filter */}
          {allFiles.size > 1 && (
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Files</option>
              {Array.from(allFiles).map(file => (
                <option key={file} value={file}>
                  {file?.substring(0, 30)}...
                </option>
              ))}
            </select>
          )}
        </div>
        
        {/* Balance and Transaction Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-green-600" />
              Balance Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Opening Balance:</span>
                <span className="font-bold text-lg text-green-600">
                  MUR {stats.openingBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Closing Balance:</span>
                <span className="font-bold text-lg text-blue-600">
                  MUR {stats.closingBalance.toLocaleString()}
                </span>
              </div>
              <div className="pt-3 border-t border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Net Change:</span>
                  <span className={`font-bold text-lg ${
                    (stats.closingBalance - stats.openingBalance) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(stats.closingBalance - stats.openingBalance) >= 0 ? '+' : ''}
                    MUR {(stats.closingBalance - stats.openingBalance).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Flow Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Transaction Flow
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Debits:</span>
                <span className="font-bold text-lg text-red-600">
                  MUR {stats.totalDebits.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Credits:</span>
                <span className="font-bold text-lg text-green-600">
                  MUR {stats.totalCredits.toLocaleString()}
                </span>
              </div>
              <div className="pt-3 border-t border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Net Flow:</span>
                  <span className={`font-bold text-lg ${
                    (stats.totalCredits - stats.totalDebits) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(stats.totalCredits - stats.totalDebits) >= 0 ? '+' : ''}
                    MUR {Math.abs(stats.totalCredits - stats.totalDebits).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categorization Progress */}
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-700">Categorization Progress</span>
            <span className="text-2xl font-bold text-blue-600">{successRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${successRate}%` }}
            >
              {successRate > 10 && (
                <span className="text-xs text-white font-medium">{stats.categorizedCount}</span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              <span className="font-medium text-green-600">{stats.categorizedCount}</span> Categorized
            </span>
            <span className="text-gray-600">
              <span className="font-medium text-red-600">{stats.uncategorizedCount}</span> Uncategorized
            </span>
            <span className="text-gray-600">
              <span className="font-medium text-blue-600">{stats.totalTransactions}</span> Total
            </span>
          </div>
        </div>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(results).map(([category, transactions]) => {
          const filteredTransactions = filterByFile(transactions);
          if (filteredTransactions.length === 0) return null;
          
          const categoryDebits = filteredTransactions.filter(t => t.isDebit).reduce((sum, t) => sum + t.amount, 0);
          const categoryCredits = filteredTransactions.filter(t => !t.isDebit).reduce((sum, t) => sum + t.amount, 0);
          const categoryTotal = categoryDebits + categoryCredits;
          const isExpanded = expandedCategories[category];
          
          return (
            <div key={category} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div 
                className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">{category}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                      {filteredTransactions.length}
                    </span>
                    {isExpanded ? 
                      <ChevronUp className="h-4 w-4 text-gray-500" /> : 
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    }
                  </div>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Total Amount:</span>
                    <span className="font-semibold text-gray-800">
                      MUR {categoryTotal.toLocaleString()}
                    </span>
                  </div>
                  {categoryDebits > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Debits:</span>
                      <span className="text-red-600">MUR {categoryDebits.toLocaleString()}</span>
                    </div>
                  )}
                  {categoryCredits > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Credits:</span>
                      <span className="text-green-600">MUR {categoryCredits.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {isExpanded && (
                <div className="max-h-96 overflow-y-auto border-t">
                  {filteredTransactions.map((transaction, index) => (
                    <div key={index} className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800 mb-1">
                            {transaction.description}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {transaction.transactionDate}
                            </span>
                            <span className={`flex items-center ${transaction.isDebit ? 'text-red-600' : 'text-green-600'}`}>
                              <DollarSign className="h-3 w-3 mr-1" />
                              {transaction.isDebit ? '-' : '+'} MUR {transaction.amount.toLocaleString()}
                            </span>
                            {transaction.confidence && (
                              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                {(transaction.confidence * 100).toFixed(0)}% match
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {transaction.sourceFile?.substring(0, 30)}...
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="text-sm font-medium text-gray-800">
                            MUR {transaction.balance.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">Balance</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Uncategorized Transactions Section */}
      {uncategorizedData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-red-200">
          <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-xl font-bold text-red-800">Uncategorized Transactions</h3>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  {filterByFile(uncategorizedData).length} items
                </span>
                <button
                  onClick={() => setShowUncategorizedDetails(!showUncategorizedDetails)}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-800 transition-colors"
                >
                  {showUncategorizedDetails ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  <span className="text-sm font-medium">
                    {showUncategorizedDetails ? 'Hide' : 'Show'}
                  </span>
                </button>
              </div>
            </div>
            
            <div className="bg-red-100 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                These transactions could not be automatically categorized and require manual review.
              </p>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 font-medium">View as:</span>
              <button
                onClick={() => setUncategorizedViewMode('list')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  uncategorizedViewMode === 'list' 
                    ? 'bg-red-200 text-red-800 font-medium' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Complete List
              </button>
              <button
                onClick={() => setUncategorizedViewMode('grouped')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  uncategorizedViewMode === 'grouped' 
                    ? 'bg-red-200 text-red-800 font-medium' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Grouped by File
              </button>
            </div>

            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-600">Total Amount</div>
                <div className="text-lg font-bold text-red-600">
                  MUR {filterByFile(uncategorizedData).reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-600">Debits</div>
                <div className="text-lg font-bold text-red-600">
                  {filterByFile(uncategorizedData).filter(t => t.isDebit).length}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-600">Credits</div>
                <div className="text-lg font-bold text-green-600">
                  {filterByFile(uncategorizedData).filter(t => !t.isDebit).length}
                </div>
              </div>
            </div>
          </div>
          
          {showUncategorizedDetails && (
            <div className="max-h-96 overflow-y-auto bg-white">
              {uncategorizedViewMode === 'list' ? (
                // List View
                <div>
                  {filterByFile(uncategorizedData).map((transaction, index) => (
                    <div key={index} className="p-4 border-b border-red-100 hover:bg-red-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 mb-2">
                            {transaction.description}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                            <div>
                              <span className="font-medium">Date:</span> {transaction.transactionDate}
                            </div>
                            <div>
                              <span className="font-medium">Value Date:</span> {transaction.valueDate}
                            </div>
                            <div>
                              <span className="font-medium">Amount:</span> 
                              <span className={transaction.isDebit ? 'text-red-600' : 'text-green-600'}>
                                {transaction.isDebit ? '-' : '+'} MUR {transaction.amount.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Balance:</span> MUR {transaction.balance.toLocaleString()}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Source:</span> {transaction.sourceFile || 'Unknown'}
                            </div>
                            {transaction.reason && (
                              <div className="col-span-2 text-red-600">
                                <span className="font-medium">Issue:</span> {transaction.reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${transaction.isDebit ? 'text-red-600' : 'text-green-600'}`}>
                          {transaction.isDebit ? '-' : '+'} {transaction.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Grouped View
                <div>
                  {Object.entries(uncategorizedByFile).map(([fileName, fileTransactions]) => {
                    const filteredFileTransactions = selectedFile === 'all' || selectedFile === fileName 
                      ? fileTransactions 
                      : [];
                    
                    if (filteredFileTransactions.length === 0) return null;
                    
                    return (
                      <div key={fileName} className="border-b border-red-100">
                        <div className="p-3 bg-red-50 border-b border-red-200 sticky top-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-red-600" />
                              <span className="font-medium text-red-800">{fileName}</span>
                            </div>
                            <span className="text-sm text-red-600 font-medium">
                              {filteredFileTransactions.length} transactions
                            </span>
                          </div>
                        </div>
                        
                        {filteredFileTransactions.map((transaction, index) => (
                          <div key={index} className="p-3 border-b border-red-50 hover:bg-red-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-800 mb-1">
                                  {transaction.description}
                                </div>
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span>{transaction.transactionDate}</span>
                                  <span className={transaction.isDebit ? 'text-red-600' : 'text-green-600'}>
                                    MUR {transaction.amount.toLocaleString()}
                                  </span>
                                  <span>Bal: {transaction.balance.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className={`text-sm font-medium ${transaction.isDebit ? 'text-red-600' : 'text-green-600'}`}>
                                {transaction.isDebit ? '-' : '+'}{transaction.amount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Recommendations */}
      {uncategorizedData.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-5">
          <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Recommendations for Uncategorized Items
          </h4>
          <div className="space-y-2 text-sm text-yellow-700">
            <div className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Review transaction descriptions to identify common patterns</span>
            </div>
            <div className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Export to Excel and add manual categories, then update the mapping rules</span>
            </div>
            <div className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Check for variations in transaction descriptions (typos, abbreviations)</span>
            </div>
            <div className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Consider adding new categories for recurring uncategorized transactions</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedResultsDisplay;
