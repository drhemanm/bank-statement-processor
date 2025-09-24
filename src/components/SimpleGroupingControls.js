import React, { useState } from 'react';
import { Download, FileText, Calendar, List, ChevronDown, Loader2 } from 'lucide-react';

const SimpleGroupingControls = ({ 
  onExportWithGrouping, 
  processing, 
  exportMode, 
  hasResults,
  transactionCount 
}) => {
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [groupingType, setGroupingType] = useState('description');

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
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Export to Excel</h3>
          <p className="text-sm text-gray-600 mt-1">
            {transactionCount} transactions ready • Export as {exportMode === 'combined' ? 'single file' : 'separate files'}
          </p>
        </div>
      </div>

      <div className="border-t pt-4">
        <button
          onClick={handleExport}
          disabled={processing || !hasResults}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 font-medium"
        >
          {processing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating Excel...</span>
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              <span>Download Excel Report</span>
            </>
          )}
        </button>
      </div>

      {/* Export Information */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-blue-900 mb-2">Excel Report Contents:</h4>
        <ul className="space-y-1 text-blue-700">
          <li>✓ Summary sheet with opening/closing balances</li>
          <li>✓ All transactions in chronological order</li>
          <li>✓ Separate sheets for each category</li>
          <li>✓ Uncategorized transactions for review</li>
          <li>✓ Balance reconciliation tracking</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleGroupingControls;
