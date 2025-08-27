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
        
        // Extract text items and join them
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
        
        addLog(`Page ${pageNum} processed`, 'info');
      }
      
      addLog(`✅ PDF text extraction complete for ${file.name}`, 'success');
      return fullText;
      
    } catch (error) {
      addLog(`❌ PDF extraction failed for ${file.name}: ${error.message}`, 'error');
      throw error;
    }
  };

  const extractTransactionsFromText = (text, fileName) => {
    const transactions = [];
    const lines = text.split('\n');
    
    addLog(`Analyzing ${lines.length} lines from ${fileName}...`, 'info');
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip headers and irrelevant lines
      if (!line || 
          line.includes('TRANS DATE') || 
          line.includes('Opening Balance') ||
          line.includes('Closing Balance') ||
          line.includes('STATEMENT') ||
          line.includes('UPLIFT MARKETING') ||
          line.includes('MCB') ||
          line.includes('Page :') ||
          line.includes('For any change') ||
          line.length < 15) {
        continue;
      }
      
      // Look for MCB transaction pattern with dates
      const dateMatches = line.match(/\d{2}\/\d{2}\/\d{4}/g);
      const numberMatches = line.match(/\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
      
      if (dateMatches && numberMatches && dateMatches.length >= 1 && numberMatches.length >= 2) {
        const transDate = dateMatches[0];
        const valueDate = dateMatches[1] || dateMatches[0];
        
        // Get amount and balance (last two numbers usually)
        const amount = parseFloat(numberMatches[numberMatches.length - 2].replace(/,/g, ''));
        const balance = parseFloat(numberMatches[numberMatches.length - 1].replace(/,/g, ''));
        
        // Extract description by removing dates and numbers
        let description = line;
        description = description.replace(/\d{2}\/\d{2}\/\d{4}/g, '');
        description = description.replace(/\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, '');
        description = description.replace(/\s+/g, ' ').trim();
        
        // Only add if we have meaningful data
        if (description.length > 5 && amount > 0 && !isNaN(amount)) {
          transactions.push({
            transactionDate: transDate,
            valueDate: valueDate,
            description: description,
            amount: amount,
            balance: balance,
            sourceFile: fileName,
            originalLine: line.substring(0, 100) // Limit length
          });
        }
      }
    }
    
    addLog(`🔍 Found ${transactions.length} potential transactions in ${fileName}`, 'success');
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
    addLog('🚀 Starting bulk processing...', 'info');

    try {
      const allTransactions = [];
      const stats = {};

      // Process each file
      for (const file of files) {
        addLog(`📄 Processing ${file.name}...`, 'info');
        
        let extractedText = '';
        
        if (file.type === 'application/pdf') {
          try {
            // Use our enhanced PDF extraction
            extractedText = await extractTextFromPDF(file);
          } catch (error) {
            addLog(`❌ Could not process PDF ${file.name}: ${error.message}`, 'error');
            continue;
          }
        } else if (file.type.startsWith('image/')) {
          addLog(`🖼️ Image OCR for ${file.name} - feature coming soon`, 'info');
          addLog(`💡 Tip: Convert images to PDF or text for now`, 'info');
          continue;
        } else {
          // For text files
          try {
            extractedText = await file.text();
            addLog(`📝 Text file processed: ${file.name}`, 'success');
          } catch (error) {
            addLog(`❌ Could not read ${file.name}: ${error.message}`, 'error');
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
          
          addLog(`✅ Extracted ${transactions.length} transactions from ${file.name}`, 'success');
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
          
          addLog(`✅ ${transaction.description.substring(0, 30)}... → ${category}`, 'success');
        } else {
          uncategorized.push({
            ...transaction,
            reason: 'No matching rule found'
          });
          
          // Update stats
          if (stats[transaction.sourceFile]) {
            stats[transaction.sourceFile].uncategorized++;
          }
          
          addLog(`⚠️ Uncategorized: ${transaction.description.substring(0, 30)}...`, 'error');
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
      
      addLog(`🎉 Processing complete!`, 'success');
      addLog(`📊 Total: ${totalProcessed}, Categorized: ${totalCategorized}, Uncategorized: ${uncategorized.length}`, 'success');
      addLog(`📈 Success Rate: ${successRate}%`, 'success');

    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
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
    
    // SECTION 4: Category Totals
    csvContent += `\n=== CATEGORY SUMMARY ===\n`;
    csvContent += `Category,Transaction Count,Total Amount (MUR),Average Amount (MUR)\n`;
    
    Object.entries(results).forEach(([category, transactions]) => {
      if (transactions.length > 0) {
        const total = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const average = (total / transactions.length).toFixed(2);
        csvContent += `"${category}","${transactions.length}","${total.toFixed(2)}","${average}"\n`;
      }
    });
    
    // Add uncategorized to summary
    if (uncategorizedData.length > 0) {
      const uncatTotal = uncategorizedData.reduce((sum, t) => sum + (t.amount || 0), 0);
      const uncatAverage = (uncatTotal / uncategorizedData.length).toFixed(2);
      csvContent += `"UNCATEGORIZED","${uncategorizedData.length}","${uncatTotal.toFixed(2)}","${uncatAverage}"\n`;
    }

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
    addLog('📋 Complete Excel report downloaded successfully!', 'success');
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
            🏦 Bank Statement Processor
          </h1>
          <p className="text-gray-600 text-lg">
            Automatically extract and categorize transactions from MCB bank statements
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
              Select multiple PDF or text files to process them all at once
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
                    📁 {files.length} files selected
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
                Processing {files.length} files...
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
            <div className="max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-4">
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
                <h3 className="text-xl font-medium text-gray-800 mb-4">📊 File Processing Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(fileStats).map(([fileName, stats]) => (
                    <div key={fileName} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 text-sm mb-2 truncate" title={fileName}>
                        📄 {fileName}
                      </h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{stats.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">✓ Categorized:</span>
                          <span className="font-medium text-green-600">{stats.categorized}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-yellow-600">⚠ Need Review:</span>
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
                  📋 Categorized Transactions
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
                      ⚠️ {uncategorizedData.length} Transactions Need Manual Review
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
                              From: {transaction.sourceFile} • Reason: {transaction.reason}
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
          <h3 className="text-lg font-medium text-green-800 mb-4">✅ System Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-green-700 mb-2">🔄 Enhanced Processing</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Full PDF text extraction</li>
                <li>• Bulk upload multiple statements</li>
                <li>• Real-time processing logs</li>
                <li>• Advanced transaction detection</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-700 mb-2">📊 Smart Analysis</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Automatic categorization</li>
                <li>• Uncategorized item flagging</li>
                <li>• Complete Excel reports</li>
                <li>• Success rate tracking</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white border rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">📋 How to Use:</h4>
            <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
              <li>Upload your MCB bank statement PDF files</li>
              <li>Click "Process Statements" and watch the real-time logs</li>
              <li>Review categorized results and uncategorized items</li>
              <li>Download the complete Excel report with all data</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-6 border-t">
          <p className="text-gray-600 text-sm">
            🚀 Bank Statement Processor v2.0 - Now with PDF Support!
          </p>
        </div>
      </div>
    </div>
  );
};

export default BankStatementProcessor;
