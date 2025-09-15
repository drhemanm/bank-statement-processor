import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Eye, EyeOff, FileText, Calendar, DollarSign } from 'lucide-react';

const EnhancedResultsDisplay = ({ results, uncategorizedData, fileStats }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showUncategorizedDetails, setShowUncategorizedDetails] = useState(true);
  const [uncategorizedViewMode, setUncategorizedViewMode] = useState('list'); // 'list' or 'grouped'

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Calculate stats
  const stats = {
    totalTransactions: Object.values(results).reduce((sum, arr) => sum + arr.length, 0) + uncategorizedData.length,
    categorizedCount: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
    uncategorizedCount: uncategorizedData.length,
    openingBalance: Object.values(fileStats).reduce((sum, stats) => sum + (stats.openingBalance || 0), 0),
    closingBalance: Object.values(fileStats).reduce((sum, stats) => sum + (stats.closingBalance || 0), 0),
  };

  // Group uncategorized by source file for better organization
  const uncategorizedByFile = uncategorizedData.reduce((acc, transaction) => {
    const file = transaction.sourceFile || 'Unknown File';
    if (!acc[file]) acc[file] = [];
    acc[file].push(transaction);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Processing Results</h2>
        <div className="text-sm text-gray-600">
          {stats.totalTransactions} total transactions processed
        </div>
      </div>
      
      {/* Enhanced Balance Summary */}
      <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-green-600">MUR {stats.openingBalance.toLocaleString()}</div>
            <div className="text-xs text-gray-600">Total Opening Balance</div>
          </div>
          <div>
            <div className="text-xl font-bold text-blue-600">MUR {stats.closingBalance.toLocaleString()}</div>
            <div className="text-xs text-gray-600">Total Closing Balance</div>
          </div>
          <div>
            <div className="text-xl font-bold text-purple-600">{stats.categorizedCount}</div>
            <div className="text-xs text-gray-600">Categorized Transactions</div>
          </div>
          <div>
            <div className="text-xl font-bold text-red-600">{stats.uncategorizedCount}</div>
            <div className="text-xs text-gray-600">Uncategorized Transactions</div>
          </div>
        </div>
      </div>

      {/* Categorization Success Rate */}
      <div className="mb-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Categorization Success Rate</span>
          <span className="text-sm font-bold text-blue-600">
            {stats.totalTransactions > 0 ? ((stats.categorizedCount / stats.totalTransactions) * 100).toFixed(1) : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${stats.totalTransactions > 0 ? (stats.categorizedCount / stats.totalTransactions) * 100 : 0}%` 
            }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Categorized Transactions */}
        {Object.entries(results).map(([category, transactions]) => {
          if (transactions.length === 0) return null;
          
          const categoryTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
          const isExpanded = expandedCategories[category];
          
          return (
            <div key={category} className="border rounded-lg overflow-hidden">
              <div 
                className="p-4 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">{category}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                      {transactions.length}
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  Total: MUR {categoryTotal.toLocaleString()}
                </div>
                
                {!isExpanded && (
                  <div className="text-xs text-gray-500">
                    Click to see {transactions.length} transactions
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="max-h-96 overflow-y-auto border-t">
                  {transactions.map((transaction, index) => (
                    <div key={index} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800 mb-1">
                            {transaction.description}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {transaction.transactionDate}
                            </span>
                            <span className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              MUR {transaction.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {transaction.sourceFile && `${transaction.sourceFile.substring(0, 20)}...`}
                            {transaction.matchedKeyword && ` • Matched: "${transaction.matchedKeyword}"`}
                          </div>
                        </div>
                        <div className="text-right">
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
        
        {/* ENHANCED UNCATEGORIZED SECTION - This was the missing piece! */}
        {uncategorizedData.length > 0 && (
          <div className="border border-red-200 rounded-lg overflow-hidden lg:col-span-2 xl:col-span-3">
            <div className="p-4 bg-red-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h3 className="font-medium text-red-800">UNCATEGORIZED TRANSACTIONS</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                    {uncategorizedData.length} transactions
                  </span>
                  <button
                    onClick={() => setShowUncategorizedDetails(!showUncategorizedDetails)}
                    className="flex items-center space-x-1 text-red-600 hover:text-red-800"
                  >
                    {showUncategorizedDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="text-sm">
                      {showUncategorizedDetails ? 'Hide' : 'Show'} Details
                    </span>
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-red-600 mb-3">
                These transactions need manual review and categorization
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-sm text-gray-600">View:</span>
                <button
                  onClick={() => setUncategorizedViewMode('list')}
                  className={`px-3 py-1 text-xs rounded ${
                    uncategorizedViewMode === 'list' 
                      ? 'bg-red-200 text-red-800' 
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setUncategorizedViewMode('grouped')}
                  className={`px-3 py-1 text-xs rounded ${
                    uncategorizedViewMode === 'grouped' 
                      ? 'bg-red-200 text-red-800' 
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  By File
                </button>
              </div>

              <div className="text-xs text-gray-600">
                Total Amount: MUR {uncategorizedData.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
              </div>
            </div>
            
            {showUncategorizedDetails && (
              <div className="max-h-96 overflow-y-auto border-t">
                {uncategorizedViewMode === 'list' ? (
                  // List all uncategorized transactions
                  <div>
                    {uncategorizedData.map((transaction, index) => (
                      <div key={index} className="p-4 border-b border-red-100 hover:bg-red-25">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-800 mb-2">
                              {transaction.description}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">Date:</span> {transaction.transactionDate}
                              </div>
                              <div>
                                <span className="font-medium">Value Date:</span> {transaction.valueDate}
                              </div>
                              <div>
                                <span className="font-medium">Amount:</span> MUR {transaction.amount.toLocaleString()}
                              </div>
                              <div>
                                <span className="font-medium">Balance:</span> MUR {transaction.balance.toLocaleString()}
                              </div>
                              <div className="col-span-2">
                                <span className="font-medium">Source:</span> {transaction.sourceFile || 'Unknown'}
                              </div>
                              {transaction.reason && (
                                <div className="col-span-2 text-red-600">
                                  <span className="font-medium">Reason:</span> {transaction.reason}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className={`text-sm font-medium ${transaction.isDebit ? 'text-red-600' : 'text-green-600'}`}>
                              {transaction.isDebit ? '-' : '+'}MUR {transaction.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {transaction.isDebit ? 'Debit' : 'Credit'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Group by file
                  <div>
                    {Object.entries(uncategorizedByFile).map(([fileName, fileTransactions]) => (
                      <div key={fileName} className="border-b border-red-100">
                        <div className="p-3 bg-red-25 border-b border-red-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-red-600" />
                              <span className="font-medium text-red-800">{fileName}</span>
                            </div>
                            <span className="text-sm text-red-600">
                              {fileTransactions.length} uncategorized
                            </span>
                          </div>
                        </div>
                        
                        {fileTransactions.map((transaction, index) => (
                          <div key={index} className="p-3 border-b border-red-50 hover:bg-red-25">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-800 mb-1">
                                  {transaction.description}
                                </div>
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span>{transaction.transactionDate}</span>
                                  <span>MUR {transaction.amount.toLocaleString()}</span>
                                  <span>Balance: MUR {transaction.balance.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className={`text-sm font-medium ${transaction.isDebit ? 'text-red-600' : 'text-green-600'}`}>
                                {transaction.isDebit ? '-' : '+'}MUR {transaction.amount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Action Suggestions for Uncategorized Items */}
      {uncategorizedData.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">💡 Suggestions for Uncategorized Items</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>• Review the transaction descriptions above to identify patterns</p>
            <p>• Consider adding new categorization rules for recurring transactions</p>
            <p>• Export to Excel to manually categorize and re-import rules</p>
            <p>• Check for typos or unusual formatting in transaction descriptions</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedResultsDisplay;
