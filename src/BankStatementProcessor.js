import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, Info } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const BankStatementProcessor = () => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const fileInputRef = useRef(null);

  // Enhanced mapping rules based on MCB statements
  const mappingRules = {
    'Business Banking Subs Fee': 'BANK CHARGES',
    'Standing order Charges': 'BANK CHARGES',
    'JUICE Account Transfer': 'SCHEME (PRIME)',
    'JuicePro Transfer': 'SCHEME (PRIME)',
    'Government Instant Payment': 'SCHEME (PRIME)',
    'Direct Debit Scheme': 'CSG',
    'MAURITIUS REVENUE AUTHORITY': 'CSG',
    'Merchant Instant Payment': 'MISCELLANEOUS',
    'Cash Cheque': 'Salary',
    'Interbank Transfer': 'PRGF',
    'ATM Cash Deposit': 'SALES',
    'Refill Amount': 'MISCELLANEOUS',
    'VAT on Refill': 'MISCELLANEOUS',
    'SHELL': 'MISCELLANEOUS',
    'Staff': 'Salary',
    'STAFF': 'Salary',
    'Salary': 'Salary'
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setFiles(uploadedFiles);
    setLogs([]);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    addLog(`${uploadedFiles.length} file(s) uploaded successfully`, 'success');
  };

  // Enhanced PDF text extraction
  const extractTextFromPDF = async (file) => {
    try {
      addLog(`Reading PDF: ${file.name}...`, 'info');
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      addLog(`PDF loaded: ${pdf.numPages} pages found`, 'success');
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text items and join them with spaces
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
        
        addLog(`Page ${pageNum} processed - ${pageText.length} characters`, 'info');
      }
      
      addLog(`PDF text extraction complete - ${fullText.length} total characters`, 'success');
      return fullText;
      
    } catch (error) {
      addLog(`PDF extraction failed for ${file.name}: ${error.message}`, 'error');
      throw error;
    }
  };

  const extractTransactionsFromText = (text, fileName) => {
    const transactions = [];
    
    addLog(`Analyzing text from ${fileName}...`, 'info');
    
    // Split the text into potential transaction segments
    // Look for patterns that indicate transaction boundaries
    const segments = text.split(/(?=\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4})/g);
    
    addLog(`Found ${segments.length} potential transaction segments`, 'info');
    
    let transactionCount = 0;
    
    for (let segment of segments) {
      segment = segment.trim();
      
      // Skip if too short or contains headers
      if (segment.length < 50 || 
          segment.includes('TRANS DATE') || 
          segment.includes('Opening Balance') ||
          segment.includes('Closing Balance') ||
          segment.includes('STATEMENT Page')) {
        continue;
      }
      
      // Extract transaction pattern: DATE DATE DESCRIPTION AMOUNT BALANCE
      const transactionPattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?=\s|$)/g;
      
      let match;
      while ((match = transactionPattern.exec(segment)) !== null) {
        const [fullMatch, transDate, valueDate, description, amount, balance] = match;
        
        const transactionAmount = parseFloat(amount.replace(/,/g, ''));
        const balanceAmount = parseFloat(balance.replace(/,/g, ''));
        
        if (transactionAmount > 0 && !isNaN(transactionAmount) && description.trim().length > 3) {
          transactions.push({
            transactionDate: transDate,
            valueDate: valueDate,
            description: description.trim(),
            amount: transactionAmount,
            balance: balanceAmount,
            sourceFile: fileName,
            originalLine: fullMatch
          });
          
          transactionCount++;
          addLog(`Transaction ${transactionCount}: ${transDate} - ${description.trim().substring(0, 40)}... - MUR ${transactionAmount}`, 'success');
        }
      }
    }
    
    addLog(`Total transactions extracted: ${transactionCount}`, 'success');
    return transactions;
  };

  const categorizeTransaction = (description) => {
    const desc = description.toLowerCase();
    
    // Check each mapping rule
    for (const [keyword, category] of Object.entries(mappingRules)) {
      if (desc.includes(keyword.toLowerCase())) {
        return { category, matched: true, keyword };
      }
    }
    
    return { category: 'UNCATEGORIZED', matched: false, keyword: null };
  };

  const processFiles = async () => {
    if (files.length === 0) {
      addLog('Please upload files first', 'error');
      return;
    }

    setProcessing(true);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    addLog('Starting enhanced processing...', 'info');

    try {
      const allTransactions = [];
      const stats = {};

      // Process each file
      for (const file of files) {
        addLog(`Processing ${file.name}...`, 'info');
        
        let extractedText = '';
        
        if (file.type === 'application/pdf') {
          try {
            extractedText = await extractTextFromPDF(file);
          } catch (error) {
            addLog(`Could not process PDF ${file.name}: ${error.message}`, 'error');
            continue;
          }
        } else {
          try {
            extractedText = await file.text();
            addLog(`Text file processed: ${file.name}`, 'success');
          } catch (error) {
            addLog(`Could not read ${file.name}: ${error.message}`, 'error');
            continue;
          }
        }

        if (extractedText) {
          const transactions = extractTransactionsFromText(extractedText, file.name);
          allTransactions.push(...transactions);
          
          // Track stats per file
          stats[file.name] = {
            total: transactions.length,
            categorized: 0,
            uncategorized: 0
          };
          
          addLog(`Final: ${transactions.length} transactions from ${file.name}`, 'success');
        }
      }

      // Initialize categorized data structure
      const categorizedData = {
        'SALES': [],
        'Salary': [],
        'CSG': [],
        'PRGF': [],
        'BANK CHARGES': [],
        'CONSULTANCY FEES': [],
        'SCHEME (PRIME)': [],
        'MISCELLANEOUS': [],
        'Transport': []
      };

      const uncategorized = [];

      // Categorize all transactions
      allTransactions.forEach(transaction => {
        const { category, matched, keyword } = categorizeTransaction(transaction.description);
        
        if (matched && category !== 'UNCATEGORIZED') {
          categorizedData[category].push({
            ...transaction,
            matchedKeyword: keyword
          });
          
          // Update stats
          if (stats[transaction.sourceFile]) {
            stats[transaction.sourceFile].categorized++;
          }
          
          addLog(`${transaction.description.substring(0, 30)}... → ${category}`, 'success');
        } else {
          uncategorized.push({
            ...transaction,
            reason: 'No matching rule found'
          });
          
          // Update stats
          if (stats[transaction.sourceFile]) {
            stats[transaction.sourceFile].uncategorized++;
          }
          
          addLog(`Uncategorized: ${transaction.description.substring(0, 30)}...`, 'error');
        }
      });

      // Set results
      setResults(categorizedData);
      setUncategorizedData(uncategorized);
      setFileStats(stats);
      
      // Summary
      const totalCategorized = Object.values(categorizedData).reduce((sum, arr) => sum + arr.length, 0);
      const totalProcessed = totalCategorized + uncategorized.length;
      const successRate = totalProcessed > 0 ? ((totalCategorized / totalProcessed) * 100).toFixed(1) : 0;
      
      addLog(`Processing complete!`, 'success');
      addLog(`Total: ${totalProcessed}, Categorized: ${totalCategorized}, Uncategorized: ${uncategorized.length}`, 'success');
      addLog(`Success Rate: ${successRate}%`, 'success');

    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      console.error('Processing error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const generateExcel = () => {
    if (!results) {
      addLog('No results to download', 'error');
      return;
    }

    let csvContent = '';
    const timestamp = new Date().toLocaleString();
    
    // Header
    csvContent += `BANK STATEMENT PROCESSING REPORT\n`;
    csvContent += `Generated: ${timestamp}\n`;
    csvContent += `Files Processed: ${Object.keys(fileStats).length}\n\n`;
    
    // SECTION 1: Categorized Transactions
    csvContent += `=== CATEGORIZED TRANSACTIONS ===\n`;
    csvContent += `Category,Amount,Date,Source File,Description,Matched Keyword\n`;
    
    Object.entries(results).forEach(([category, transactions]) => {
      transactions.forEach(t => {
        const cleanDesc = (t.description || '').replace(/"/g, '""');
        const cleanKeyword = (t.matchedKeyword || '').replace(/"/g, '""');
        csvContent += `"${category}","${t.amount}","${t.transactionDate}","${t.sourceFile}","${cleanDesc}","${cleanKeyword}"\n`;
      });
    });
    
    // SECTION 2: Uncategorized Transactions
    if (uncategorizedData.length > 0) {
      csvContent += `\n=== UNCATEGORIZED TRANSACTIONS (NEEDS MANUAL REVIEW) ===\n`;
      csvContent += `Amount,Date,Source File,Description,Reason\n`;
      
      uncategorizedData.forEach(t => {
        const cleanDesc = (t.description || '').replace(/"/g, '""');
        const cleanReason = (t.reason || '').replace(/"/g, '""');
        csvContent += `"${t.amount}","${t.transactionDate}","${t.sourceFile}","${cleanDesc}","${cleanReason}"\n`;
      });
    }
    
    // SECTION 3: Summary Statistics
    csvContent += `\n=== PROCESSING SUMMARY ===\n`;
    csvContent += `File Name,Total Transactions,Categorized,Uncategorized,Success Rate\n`;
    
    Object.entries(fileStats).forEach(([fileName, stats]) => {
      const successRate = stats.total > 0 ? ((stats.categorized / stats.total) * 100).toFixed(1) : 0;
      csvContent += `"${fileName}","${stats.total}","${stats.categorized}","${stats.uncategorized}","${successRate}%"\n`;
    });

    // Download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bank_Statements_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    addLog('Complete report downloaded!', 'success');
  };

  // Calculate totals for display
  const getTotalStats = () => {
    if (!results) return { totalTransactions: 0, totalAmount: 0, categories: 0 };
    
    let totalTransactions = 0;
    let totalAmount = 0;
    let categories = 0;
    
    Object.entries(results).forEach(([category, transactions]) => {
      if (transactions.length > 0) {
        totalTransactions += transactions.length;
        totalAmount += transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        categories++;
      }
    });
    
    return { totalTransactions, totalAmount, categories };
  };

  const { totalTransactions, totalAmount, categories } = getTotalStats();

  return (
    <div className="min-h-screen bg-gradient-to-br">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Bank Statement Processor
          </h1>
          <p className="text-gray-600 text-lg">
            Advanced PDF processing with intelligent transaction extraction
          </p>
        </div>

        {/* Quick Stats (when results available) */}
        {results && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">{totalTransactions + uncategorizedData.length}</div>
              <div className="text-sm text-gray-600">Total Transactions</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-green-600">{totalTransactions}</div>
              <div className="text-sm text-gray-600">Categorized</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-yellow-600">{uncategorizedData.length}</div>
              <div className="text-sm text-gray-600">Need Review</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">MUR {totalAmount.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Amount</div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="text-center">
            <Upload className="mx-auto h-16 w-16 text-blue-500 mb-4" />
            <h3 className="text-2xl font-medium text-gray-900 mb-2">
              Upload Bank Statements
            </h3>
            <p className="text-gray-600 mb-6">
              PDF and text files supported - intelligent transaction detection
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center"
            >
              <Upload className="h-5 w-5 mr-2" />
              Choose Files
            </button>
            
            {files.length > 0 && (
              <div className="mt-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-blue-800 font-medium mb-3">
                    {files.length} files selected
                  </p>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center bg-white rounded p-2 text-sm">
                          <FileText className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="truncate text-gray-700">{file.name}</span>
                          <span className="ml-2 text-gray-400 text-xs">
                            {(file.size / 1024).toFixed(1)}KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Process Button */}
        <div className="text-center mb-6">
          <button
            onClick={processFiles}
            disabled={processing || files.length === 0}
            className={`px-8 py-4 rounded-lg font-medium text-lg transition-all inline-flex items-center ${
              processing || files.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            <Play className="h-6 w-6 mr-3" />
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              `Process ${files.length} Statement${files.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>

        {/* Processing Logs */}
        {logs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex items-center mb-4">
              <Info className="h-5 w-5 text-blue-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-800">Processing Logs</h3>
            </div>
            <div className="max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start text-sm">
                    <div className="mr-3 mt-1">
                      {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {log.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {log.type === 'info' && <div className="h-2 w-2 bg-blue-500 rounded-full mt-1" />}
                    </div>
                    <div>
                      <span className="text-gray-500 mr-2">{log.timestamp}</span>
                      <span className={`${log.type === 'error' ? 'text-red-600' : log.type === 'success' ? 'text-green-600' : 'text-gray-700'}`}>
                        {log.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div className="space-y-6">
            
            {/* File Processing Stats */}
            {Object.keys(fileStats).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-xl font-medium text-gray-800 mb-4">File Processing Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(fileStats).map(([fileName, stats]) => (
                    <div key={fileName} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 text-sm mb-2 truncate" title={fileName}>
                        {fileName}
                      </h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{stats.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Categorized:</span>
                          <span className="font-medium text-green-600">{stats.categorized}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-yellow-600">Need Review:</span>
                          <span className="font-medium text-yellow-600">{stats.uncategorized}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-1">
                          <span className="text-blue-600">Success Rate:</span>
                          <span className="font-medium text-blue-600">
                            {stats.total > 0 ? ((stats.categorized / stats.total) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Results */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-800">
                  Categorized Transactions
                </h3>
                <button
                  onClick={generateExcel}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download Complete Report
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(results).map(([category, transactions]) => (
                  <div key={category} className="bg-gray-50 rounded-lg p-4 border">
                    <h4 className="font-medium text-gray-800 mb-2">{category}</h4>
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {transactions.length}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      MUR {transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
                    </p>
                    {transactions.length > 0 && (
                      <div className="space-y-1">
                        {transactions.slice(0, 2).map((t, i) => (
                          <div key={i} className="text-xs text-gray-500 truncate bg-white rounded px-2 py-1">
                            {t.transactionDate}: MUR {t.amount?.toLocaleString()}
                          </div>
                        ))}
                        {transactions.length > 2 && (
                          <div className="text-xs text-gray-400">
                            +{transactions.length - 2} more transactions
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Uncategorized Data Alert */}
            {uncategorizedData.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6">
                <div className="flex items-start">
                  <AlertCircle className="h-6 w-6 text-yellow-600 mr-3 mt-1" />
                  <div>
                    <h3 className="text-lg font-medium text-yellow-800 mb-2">
                      {uncategorizedData.length} Transactions Need Manual Review
                    </h3>
                    <p className="text-yellow-700 mb-4">
                      These transactions couldn't be automatically categorized. They're included 
                      in your download for manual classification.
                    </p>
                    
                    <div className="bg-white border rounded-lg p-4 max-h-48 overflow-y-auto">
                      <h4 className="font-medium text-gray-800 mb-3">Preview of Uncategorized Items:</h4>
                      <div className="space-y-2">
                        {uncategorizedData.slice(0, 5).map((transaction, i) => (
                          <div key={i} className="border-b pb-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-gray-800">
                                {transaction.transactionDate}
                              </span>
                              <span className="text-lg font-bold text-gray-900">
                                MUR {transaction.amount?.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 truncate mb-1">
                              {transaction.description}
                            </div>
                            <div className="text-xs text-gray-400">
                              From: {transaction.sourceFile}
                            </div>
                          </div>
                        ))}
                        {uncategorizedData.length > 5 && (
                          <div className="text-sm text-yellow-600 text-center pt-2">
                            ... and {uncategorizedData.length - 5} more in the complete report
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Features & Instructions */}
        <div className="mt-8 bg-green-50 border rounded-xl p-6">
          <h3 className="text-lg font-medium text-green-800 mb-4">System Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-green-700 mb-2">Smart Processing</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Intelligent PDF text extraction</li>
                <li>• Advanced transaction parsing</li>
                <li>• Bulk file processing</li>
                <li>• Real-time progress tracking</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-700 mb-2">Advanced Analysis</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Automatic categorization</li>
                <li>• Uncategorized detection</li>
                <li>• Comprehensive reporting</li>
                <li>• Success rate analytics</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-6 border-t">
          <p className="text-gray-600 text-sm">
            Bank Statement Processor v4.0 - Production Ready
          </p>
        </div>
      </div>
    </div>
  );
};

export default BankStatementProcessor;
