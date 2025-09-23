// Updated EnhancedResultsDisplay.js to handle the new categories

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Eye, EyeOff, FileText, Calendar, DollarSign } from 'lucide-react';

const EnhancedResultsDisplay = ({ results, uncategorizedData, fileStats }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showUncategorizedDetails, setShowUncategorizedDetails] = useState(true);
  const [uncategorizedViewMode, setUncategorizedViewMode] = useState('list');

  // Updated category colors for your new categories
  const categoryColors = {
    'CSG/PRGF': 'bg-blue-50 text-blue-800 border-blue-200',
    'Prime (Scheme)': 'bg-purple-50 text-purple-800 border-purple-200', 
    'Consultancy Fee': 'bg-indigo-50 text-indigo-800 border-indigo-200',
    'Salary': 'bg-green-50 text-green-800 border-green-200',
    'Purchase/Payment/Expense': 'bg-red-50 text-red-800 border-red-200',
    'Sales': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'Cash withdrawal': 'bg-orange-50 text-orange-800 border-orange-200',
    'Cash Deposit': 'bg-teal-50 text-teal-800 border-teal-200',
    'Bank Charges': 'bg-gray-50 text-gray-800 border-gray-200',
    'Miscellaneous': 'bg-yellow-50 text-yellow-800 border-yellow-200',
    'Uncategorised': 'bg-red-50 text-red-800 border-red-200'
  };

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

  // Group uncategorized by source file
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
            <div className="text-xs text-gray-600">Uncategorised Transactions</div>
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

      {/* Category Grid - Updated for your categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(results).map(([category, transactions]) => {
          if (transactions.length === 0) return null;
          
          const categoryTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
          const isExpanded = expandedCategories[category];
          const colorClass = categoryColors[category] || 'bg-gray-50 text-gray-800 border-gray-200';
          
          return (
            <div key={category} className={`border rounded-lg overflow-hidden ${colorClass.split(' ')[2]}`}>
              <div 
                className={`p-4 ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{category}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded ${colorClass}`}>
                      {transactions.length}
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                
                <div className="text-sm mb-2">
                  Total: MUR {categoryTotal.toLocaleString()}
                </div>
                
                {!isExpanded && (
                  <div className="text-xs opacity-75">
                    Click to see {transactions.length} transactions
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="max-h-96 overflow-y-auto border-t bg-white">
                  {transactions.map((transaction, index) => (
                    <div key={index} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800 mb-1 break-words">
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
                            <span className={`px-1 py-0.5 rounded text-xs ${
                              transaction.isDebit ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {transaction.isDebit ? 'Debit' : 'Credit'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {transaction.sourceFile && `${transaction.sourceFile.substring(0, 20)}...`}
                          </div>
                        </div>
                        <div className="text-right ml-4">
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
        
        {/* UNCATEGORISED SECTION - Now using your terminology */}
        {uncategorizedData.length > 0 && (
          <div className="border border-red-200 rounded-lg overflow-hidden lg:col-span-2 xl:col-span-3">
            <div className="p-4 bg-red-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h3 className="font-medium text-red-800">UNCATEGORISED TRANSACTIONS</h3>
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
                These transactions don't match any of your defined categories and will be exported to a separate "Uncategorised" sheet
              </div>

              <div className="text-xs text-gray-600">
                Total Amount: MUR {uncategorizedData.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
              </div>
            </div>
            
            {showUncategorizedDetails && (
              <div className="max-h-96 overflow-y-auto border-t">
                {uncategorizedData.map((transaction, index) => (
                  <div key={index} className="p-4 border-b border-red-100 hover:bg-red-25">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-800 mb-2 break-words">
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
            )}
          </div>
        )}
      </div>
      
      {/* Updated suggestions for your categories */}
      {uncategorizedData.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">💡 Suggestions for Uncategorised Items</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>• Review transaction descriptions to see if they match your defined categories</p>
            <p>• Consider adding new patterns to your mapping rules for recurring transactions</p>
            <p>• Check if transaction descriptions have slight variations from your patterns</p>
            <p>• Uncategorised transactions will be exported to a separate sheet for manual review</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedResultsDisplay;
