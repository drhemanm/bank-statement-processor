import React, { useState } from 'react';
import { Download, FileText, Calendar, List, ChevronDown } from 'lucide-react';

const SimpleGroupingControls = ({ 
  onExportWithGrouping, 
  processing, 
  exportMode, 
  hasResults,
  transactionCount 
}) => {
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [groupingType, setGroupingType] = useState('description'); // 'description' or 'date'

  if (!hasResults) return null;

  const handleExport = () => {
    const config = {
      enabled: groupingEnabled,
      type: groupingType,
      exportMode: exportMode
    };
    onExportWithGrouping(config);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Export Options</h3>
          <p className="text-sm text-gray-600">{transactionCount} transactions ready to export</p>
        </div>
      </div>

      {/* Simple Yes/No Grouping Question */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="enableGrouping"
            checked={groupingEnabled}
            onChange={(e) => setGroupingEnabled(e.target.checked)}
            disabled={processing}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="enableGrouping" className="text-sm font-medium text-gray-700">
            Do you want to group similar transactions together?
          </label>
        </div>
        
        {groupingEnabled && (
          <div className="mt-4 ml-7 space-y-3">
            <p className="text-sm text-gray-600 mb-3">How would you like to group the transactions?</p>
            
            {/* Grouping Type Selection */}
            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer">
                <input
                  type="radio"
                  value="description"
                  checked={groupingType === 'description'}
                  onChange={(e) => setGroupingType(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <List className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-800">Group by Description</div>
                  <div className="text-xs text-gray-600">Similar transactions together (e.g., all ATM deposits, all salary payments)</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer">
                <input
                  type="radio"
                  value="date"
                  checked={groupingType === 'date'}
                  onChange={(e) => setGroupingType(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <Calendar className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-800">Group by Date</div>
                  <div className="text-xs text-gray-600">Transactions organized by time periods (monthly)</div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Export Button */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-600">
          {groupingEnabled ? (
            <span>Will create grouped Excel with <strong>{groupingType}</strong> organization</span>
          ) : (
            <span>Will create standard Excel in original document order</span>
          )}
        </div>
        
        <button
          onClick={handleExport}
          disabled={processing}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export Excel</span>
        </button>
      </div>
    </div>
  );
};

export default SimpleGroupingControls;
