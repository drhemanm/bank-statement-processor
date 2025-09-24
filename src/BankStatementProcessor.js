import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Loader2, Eye, Settings } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import EnhancedResultsDisplay from './components/EnhancedResultsDisplay';
import SimpleGroupingControls from './components/SimpleGroupingControls';
import { generateExcelReport } from './utils/excelExport';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const BankStatementProcessor = () => {
  // State management with proper initialization
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({});
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [statementMetadata, setStatementMetadata] = useState({});
  const [logs, setLogs] = useState([]);
  const [exportMode, setExportMode] = useState('combined');
  const [documentCounters, setDocumentCounters] = useState({});
  const [showLogs, setShowLogs] = useState(false);

  // Enhanced categorization mapping with your specific categories
  const categoryMapping = {
    'CSG/PRGF': [
      'csg', 'prgf', 'contribution sociale', 'government contribution',
      'social security', 'pension fund', 'retirement fund'
    ],
    'Prime (Scheme)': [
      'prime', 'bonus', 'incentive', 'scheme payment', 'performance bonus',
      'end year bonus', 'annual bonus', 'productivity bonus'
    ],
    'Consultancy Fee': [
      'consultancy', 'consulting fee', 'advisory fee', 'professional service',
      'consulting charge', 'expert fee', 'consultation'
    ],
    'Salary': [
      'salary', 'wage', 'staff payment', 'employee payment', 'payroll',
      'monthly salary', 'basic salary', 'remuneration', 'staff salary'
    ],
    'Purchase/Payment/Expense': [
      'purchase', 'payment', 'expense', 'bill payment', 'utility payment',
      'vendor payment', 'supplier payment', 'invoice payment', 'settlement'
    ],
    'Sales': [
      'sales', 'revenue', 'income', 'receipt', 'customer payment',
      'sales receipt', 'collection', 'receivable'
    ],
    'Cash withdrawal': [
      'cash withdrawal', 'atm withdrawal', 'cash advance', 'withdraw',
      'atm', 'cash out', 'withdrawal'
    ],
    'Cash Deposit': [
      'cash deposit', 'deposit', 'cash in', 'lodgement', 'cash lodgement',
      'deposit cash', 'cash payment'
    ],
    'Bank Charges': [
      'bank charge', 'service charge', 'fee', 'commission', 'bank fee',
      'transaction fee', 'maintenance fee', 'processing fee', 'handling charge'
    ],
    'Miscellaneous': [
      'miscellaneous', 'other', 'sundry', 'various', 'general',
      'misc', 'other income', 'other expense'
    ]
  };

  // Add log function
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setLogs(prev => [logEntry, ...prev]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // File handling
  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    const pdfFiles = uploadedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== uploadedFiles.length) {
      addLog('Only PDF files are supported. Some files were ignored.', 'warning');
    }
    
    if (pdfFiles.length === 0) {
      addLog('No valid PDF files selected.', 'error');
      return;
    }

    setFiles(pdfFiles);
    addLog(`${pdfFiles.length} PDF file(s) selected for processing.`, 'success');
    
    // Reset previous results
    setResults({});
    setUncategorizedData([]);
    setFileStats({});
    setStatementMetadata({});
    setDocumentCounters({});
  };

  // Enhanced OCR function with Claude Vision API
  const enhanceOCRWithClaude = async (ocrText, imageData = null, isImage = false, pageNumber = 1) => {
    try {
      const response = await fetch('/api/enhance-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ocrText: ocrText,
          imageData: imageData,
          isImage: isImage,
          pageNumber: pageNumber
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      return isImage ? data.ocrText : data.enhancedText;
    } catch (error) {
      addLog(`OCR enhancement failed for page ${pageNumber}: ${error.message}`, 'warning');
      return ocrText; // Return original text if enhancement fails
    }
  };

  // Improved PDF processing with enhanced OCR
  const processPDF = async (file) => {
    try {
      addLog(`Processing PDF: ${file.name}`, 'info');
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allText = '';
      let pageTexts = [];
      let successfulPages = 0;

      // Process each page with better error handling
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        addLog(`Processing page ${pageNum}/${pdf.numPages} of ${file.name}`, 'info');
        
        try {
          const page = await pdf.getPage(pageNum);
          let pageText = '';
          
          // Strategy 1: Try direct text extraction first
          try {
            const textContent = await page.getTextContent();
            pageText = textContent.items.map(item => item.str).join(' ');
            
            // Check if we got meaningful text (not just spaces/numbers)
            const meaningfulText = pageText.replace(/[\s\d\.,\-\/]/g, '');
            if (meaningfulText.length < 20) {
              throw new Error('Insufficient meaningful text extracted');
            }
            
            addLog(`Page ${pageNum}: Direct text extraction successful (${pageText.length} chars)`, 'info');
            
          } catch (textError) {
            addLog(`Page ${pageNum}: Direct text extraction failed, trying OCR...`, 'info');
            
            // Strategy 2: OCR fallback
            const canvas = document.createElement('canvas');
            const canvasContext = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: 2.0 });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
              canvasContext: canvasContext,
              viewport: viewport
            }).promise;
            
            // Try Claude Vision API first
            try {
              const imageDataUrl = canvas.toDataURL('image/png');
              const base64Data = imageDataUrl.split(',')[1];
              
              pageText = await enhanceOCRWithClaude('', base64Data, true, pageNum);
              
              if (pageText && pageText.trim().length > 20) {
                addLog(`Page ${pageNum}: Claude Vision OCR successful`, 'info');
              } else {
                throw new Error('Claude Vision OCR returned insufficient text');
              }
              
            } catch (claudeError) {
              addLog(`Page ${pageNum}: Claude Vision failed, trying Tesseract...`, 'warning');
              
              // Strategy 3: Tesseract fallback
              try {
                const ocrResult = await Tesseract.recognize(canvas, 'eng', {
                  logger: m => {
                    if (m.status === 'recognizing text') {
                      addLog(`OCR progress page ${pageNum}: ${Math.round(m.progress * 100)}%`, 'info');
                    }
                  }
                });
                
                pageText = ocrResult.data.text;
                addLog(`Page ${pageNum}: Tesseract OCR completed`, 'info');
                
              } catch (tesseractError) {
                addLog(`Page ${pageNum}: All OCR methods failed - ${tesseractError.message}`, 'error');
                pageText = `[Page ${pageNum}: Text extraction failed]`;
              }
            }
          }
          
          // Strategy 4: Enhance text with Claude if we have content
          if (pageText && pageText.trim().length > 20) {
            try {
              const enhancedText = await enhanceOCRWithClaude(pageText, null, false, pageNum);
              if (enhancedText && enhancedText.trim().length > pageText.trim().length * 0.5) {
                pageText = enhancedText;
                addLog(`Page ${pageNum}: Text enhancement successful`, 'info');
              }
            } catch (enhanceError) {
              addLog(`Page ${pageNum}: Text enhancement failed, using original text`, 'warning');
            }
          }
          
          pageTexts.push(pageText);
          allText += pageText + '\n\n';
          successfulPages++;
          
        } catch (pageError) {
          addLog(`Error processing page ${pageNum}: ${pageError.message}`, 'error');
          pageTexts.push(`[Page ${pageNum}: Processing failed - ${pageError.message}]`);
          continue;
        }
      }

      if (successfulPages === 0) {
        throw new Error('No pages could be processed successfully');
      }

      if (!allText.trim() || allText.trim().length < 50) {
        throw new Error('Insufficient text could be extracted from this PDF');
      }

      addLog(`Successfully processed ${successfulPages}/${pdf.numPages} pages from ${file.name} (${allText.length} characters)`, 'success');
      return allText;

    } catch (error) {
      addLog(`Failed to process ${file.name}: ${error.message}`, 'error');
      throw error;
    }
  };

  // Extract metadata from statement text
  const extractStatementMetadata = (text, fileName) => {
    const metadata = {
      fileName: fileName,
      accountNumber: null,
      iban: null,
      statementPeriod: null,
      currency: 'MUR',
      openingBalance: 0,
      closingBalance: 0
    };

    // Extract account number (various patterns)
    const accountPatterns = [
      /account\s*(?:number|no\.?|#)?\s*:?\s*(\d+)/i,
      /a\/c\s*(?:no\.?|number)?\s*:?\s*(\d+)/i,
      /(?:account|a\/c)\s*(\d{10,})/i
    ];

    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.accountNumber = match[1];
        break;
      }
    }

    // Extract IBAN
    const ibanMatch = text.match(/IBAN\s*:?\s*([A-Z]{2}\d{2}[A-Z\d]+)/i);
    if (ibanMatch) {
      metadata.iban = ibanMatch[1];
    }

    // Extract statement period
    const periodPatterns = [
      /(?:statement|period|from)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(?:to|until|-)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:to|-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];

    for (const pattern of periodPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.statementPeriod = `${match[1]} to ${match[2]}`;
        break;
      }
    }

    // Extract opening balance
    const openingBalancePatterns = [
      /(?:opening|previous|brought\s+forward|b\/f)\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
      /balance\s+(?:brought\s+)?forward\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
      /previous\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i
    ];

    for (const pattern of openingBalancePatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.openingBalance = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // Extract closing balance
    const closingBalancePatterns = [
      /(?:closing|final|current)\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
      /balance\s+(?:carried\s+)?forward\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
      /current\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i
    ];

    for (const pattern of closingBalancePatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.closingBalance = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    return metadata;
  };

  // Enhanced transaction extraction with multiple patterns
  const extractTransactions = (text, fileName) => {
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Multiple transaction patterns to handle different bank formats
    const transactionPatterns = [
      // Pattern 1: Date Date Description Amount Balance
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})?\s*(.+?)\s+([-+]?\d{1,3}(?:,\d{3})*\.?\d*)\s+([-+]?\d{1,3}(?:,\d{3})*\.?\d*)$/,
      
      // Pattern 2: Date Description Amount Balance (no value date)
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([-+]?\d{1,3}(?:,\d{3})*\.?\d*)\s+([-+]?\d{1,3}(?:,\d{3})*\.?\d*)$/,
      
      // Pattern 3: DD-MM-YYYY format
      /(\d{1,2}-\d{1,2}-\d{4})\s+(\d{1,2}-\d{1,2}-\d{4})?\s*(.+?)\s+([-+]?\d{1,3}(?:,\d{3})*\.?\d*)\s+([-+]?\d{1,3}(?:,\d{3})*\.?\d*)$/,
      
      // Pattern 4: More flexible spacing
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+([-+]?\s?\d{1,3}(?:,\d{3})*\.?\d*)\s+([-+]?\s?\d{1,3}(?:,\d{3})*\.?\d*)$/
    ];
    
    let transactionCounter = 0;

    for (const line of lines) {
      let matched = false;
      
      // Try each pattern
      for (let i = 0; i < transactionPatterns.length && !matched; i++) {
        const pattern = transactionPatterns[i];
        const match = line.match(pattern);
        
        if (match) {
          matched = true;
          transactionCounter++;
          
          let transactionDate, valueDate, description, amountStr, balanceStr;
          
          if (match.length === 6) {
            // Pattern with value date
            [, transactionDate, valueDate, description, amountStr, balanceStr] = match;
            valueDate = valueDate || transactionDate;
          } else {
            // Pattern without value date
            [, transactionDate, description, amountStr, balanceStr] = match;
            valueDate = transactionDate;
          }
          
          // Clean and parse amounts
          amountStr = amountStr.replace(/\s+/g, '').replace(/,/g, '');
          balanceStr = balanceStr.replace(/\s+/g, '').replace(/,/g, '');
          
          const amount = Math.abs(parseFloat(amountStr));
          const balance = parseFloat(balanceStr);
          
          // Determine if it's a debit
          const isDebit = amountStr.includes('-') || 
                         description.toLowerCase().includes('withdrawal') || 
                         description.toLowerCase().includes('charge') ||
                         description.toLowerCase().includes('fee');
          
          // Clean description
          description = description.replace(/\s+/g, ' ').trim();
          
          // Validate parsed values
          if (!isNaN(amount) && !isNaN(balance) && amount > 0 && description.length > 2) {
            transactions.push({
              transactionDate: transactionDate.replace(/-/g, '/'), // Normalize date format
              valueDate: valueDate.replace(/-/g, '/'),
              description,
              amount,
              balance,
              isDebit,
              sourceFile: fileName,
              transactionId: `${fileName}_${transactionCounter}`,
              rawLine: line // Keep original for debugging
            });
          }
        }
      }
    }

    addLog(`Extracted ${transactions.length} transactions from ${fileName}`, 'info');
    return transactions;
  };

  // Categorization logic
  const categorizeTransaction = (transaction) => {
    const description = transaction.description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryMapping)) {
      for (const keyword of keywords) {
        if (description.includes(keyword.toLowerCase())) {
          return {
            category,
            matchedKeyword: keyword,
            confidence: 0.9
          };
        }
      }
    }
    
    return null; // No match found
  };

  // Main processing function
  const processFiles = async () => {
    if (files.length === 0) {
      addLog('No files selected for processing.', 'error');
      return;
    }

    setProcessing(true);
    setLogs([]);
    
    const newResults = {};
    const newUncategorized = [];
    const newFileStats = {};
    const newStatementMetadata = {};
    const newCounters = {};

    // Initialize categories
    Object.keys(categoryMapping).forEach(category => {
      newResults[category] = [];
    });

    try {
      addLog(`Starting processing of ${files.length} file(s)...`, 'info');
      
      for (const file of files) {
        try {
          // Extract text from PDF
          const extractedText = await processPDF(file);
          
          // Extract metadata
          const metadata = extractStatementMetadata(extractedText, file.name);
          newStatementMetadata[file.name] = metadata;
          
          // Extract transactions
          const transactions = extractTransactions(extractedText, file.name);
          
          addLog(`Extracted ${transactions.length} transactions from ${file.name}`, 'info');
          
          // Categorize transactions
          let categorized = 0;
          let uncategorized = 0;
          
          for (const transaction of transactions) {
            const categoryResult = categorizeTransaction(transaction);
            
            if (categoryResult) {
              transaction.category = categoryResult.category;
              transaction.matchedKeyword = categoryResult.matchedKeyword;
              newResults[categoryResult.category].push(transaction);
              categorized++;
            } else {
              transaction.category = 'Uncategorised';
              newUncategorized.push(transaction);
              uncategorized++;
            }
          }
          
          // Store file statistics
          newFileStats[file.name] = {
            status: 'success',
            total: transactions.length,
            categorized: categorized,
            uncategorized: uncategorized,
            successRate: transactions.length > 0 ? ((categorized / transactions.length) * 100).toFixed(1) : 0
          };

          newCounters[file.name] = { processed: transactions.length };
          
          addLog(`${file.name}: ${categorized} categorized, ${uncategorized} uncategorised`, 'success');
          
        } catch (fileError) {
          addLog(`Failed to process ${file.name}: ${fileError.message}`, 'error');
          newFileStats[file.name] = {
            status: 'error',
            error: fileError.message,
            total: 0,
            categorized: 0,
            uncategorized: 0
          };
        }
      }

      // Update state
      setResults(newResults);
      setUncategorizedData(newUncategorized);
      setFileStats(newFileStats);
      setStatementMetadata(newStatementMetadata);
      setDocumentCounters(newCounters);

      const totalTransactions = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0) + newUncategorized.length;
      const totalCategorized = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0);
      
      addLog(`Processing complete! ${totalTransactions} total transactions, ${totalCategorized} categorized, ${newUncategorized.length} uncategorised`, 'success');
      
    } catch (error) {
      addLog(`Processing failed: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Export with grouping
  const handleExportWithGrouping = async (groupingConfig) => {
    if (!results || Object.keys(results).length === 0) {
      addLog('No data to export', 'error');
      return;
    }

    try {
      setProcessing(true);
      await generateExcelReport(
        results,
        uncategorizedData,
        fileStats,
        exportMode,
        documentCounters,
        statementMetadata,
        addLog,
        groupingConfig
      );
    } catch (error) {
      addLog(`Export failed: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Check if we have results to display
  const hasResults = results && Object.keys(results).length > 0 && (
    Object.values(results).some(arr => arr && arr.length > 0) || 
    (uncategorizedData && uncategorizedData.length > 0)
  );

  const totalTransactions = hasResults ? 
    Object.values(results).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0) + (uncategorizedData ? uncategorizedData.length : 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Bank Statement Processor</h1>
          </div>
          <p className="text-lg text-gray-600">
            Automated transaction categorization and Excel export with enhanced OCR
          </p>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Upload Bank Statements</h2>
              <div className="text-sm text-gray-500">
                Supports PDF files with OCR enhancement
              </div>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-400 transition-colors">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <label className="cursor-pointer">
                    <span className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block">
                      Choose PDF Files
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={processing}
                    />
                  </label>
                  <p className="text-sm text-gray-500">
                    Select one or more PDF bank statement files
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Selected Files ({files.length})</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center space-x-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-xs">({Math.round(file.size / 1024)} KB)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Mode Selection */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-700 mb-3">Export Mode</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer">
                  <input
                    type="radio"
                    value="combined"
                    checked={exportMode === 'combined'}
                    onChange={(e) => setExportMode(e.target.value)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-800">Combined Excel</div>
                    <div className="text-sm text-gray-600">Single file with separate sheets per document</div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer">
                  <input
                    type="radio"
                    value="separate"
                    checked={exportMode === 'separate'}
                    onChange={(e) => setExportMode(e.target.value)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-800">Separate Files</div>
                    <div className="text-sm text-gray-600">Individual Excel file per document</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Process Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">{showLogs ? 'Hide' : 'Show'} Processing Logs</span>
                </button>
              </div>
              
              <button
                onClick={processFiles}
                disabled={files.length === 0 || processing}
                className="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    <span>Process Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Processing Logs */}
        {showLogs && logs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Processing Logs</h3>
            <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-sm">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm ${
                    log.type === 'error' ? 'bg-red-50 text-red-700' :
                    log.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    log.type === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-gray-500">{log.timestamp}</span> - {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Display */}
        {hasResults && (
          <EnhancedResultsDisplay
            results={results || {}}
            uncategorizedData={uncategorizedData || []}
            fileStats={fileStats || {}}
          />
        )}

        {/* Export Controls */}
        {hasResults && (
          <SimpleGroupingControls
            onExportWithGrouping={handleExportWithGrouping}
            processing={processing}
            exportMode={exportMode}
            hasResults={hasResults}
            transactionCount={totalTransactions}
          />
        )}

        {/* Processing Status */}
        {processing && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border p-4 flex items-center space-x-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-gray-700">Processing documents...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankStatementProcessor;
