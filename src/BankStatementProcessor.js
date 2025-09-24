import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Loader2, Eye, Settings, Zap } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import EnhancedResultsDisplay from './components/EnhancedResultsDisplay';
import SimpleGroupingControls from './components/SimpleGroupingControls';
import { generateExcelReport } from './utils/excelExport';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const BankStatementProcessor = () => {
  // Enhanced state management
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
  const [aiEnhancementEnabled, setAiEnhancementEnabled] = useState(true);
  const [apiStatus, setApiStatus] = useState('unknown'); // 'working', 'error', 'unknown'

  // Enhanced categorization mapping with machine learning-like patterns
  const categoryMapping = {
    'CSG/PRGF': {
      keywords: ['csg', 'prgf', 'contribution sociale', 'government contribution', 'social security', 'pension fund', 'retirement fund', 'national pension scheme'],
      patterns: [/csg/i, /prgf/i, /contribution.*sociale/i, /pension.*fund/i]
    },
    'Prime (Scheme)': {
      keywords: ['prime', 'bonus', 'incentive', 'scheme payment', 'performance bonus', 'end year bonus', 'annual bonus', 'productivity bonus', '13th month'],
      patterns: [/prime/i, /bonus/i, /incentive/i, /13th.*month/i]
    },
    'Consultancy Fee': {
      keywords: ['consultancy', 'consulting fee', 'advisory fee', 'professional service', 'consulting charge', 'expert fee', 'consultation', 'freelance'],
      patterns: [/consult/i, /advisory/i, /professional.*service/i, /freelance/i]
    },
    'Salary': {
      keywords: ['salary', 'wage', 'staff payment', 'employee payment', 'payroll', 'monthly salary', 'basic salary', 'remuneration', 'staff salary', 'net pay'],
      patterns: [/salary/i, /wage/i, /payroll/i, /remuneration/i, /net.*pay/i]
    },
    'Purchase/Payment/Expense': {
      keywords: ['purchase', 'payment', 'expense', 'bill payment', 'utility payment', 'vendor payment', 'supplier payment', 'invoice payment', 'settlement', 'ceb', 'cwa', 'telecom'],
      patterns: [/purchase/i, /payment.*to/i, /bill.*payment/i, /utility/i, /invoice/i, /ceb/i, /cwa/i]
    },
    'Sales': {
      keywords: ['sales', 'revenue', 'income', 'receipt', 'customer payment', 'sales receipt', 'collection', 'receivable', 'deposit from'],
      patterns: [/sales/i, /revenue/i, /receipt.*from/i, /collection/i, /deposit.*from/i]
    },
    'Cash withdrawal': {
      keywords: ['cash withdrawal', 'atm withdrawal', 'cash advance', 'withdraw', 'atm', 'cash out', 'withdrawal'],
      patterns: [/cash.*withdrawal/i, /atm.*withdrawal/i, /withdraw/i, /cash.*out/i]
    },
    'Cash Deposit': {
      keywords: ['cash deposit', 'deposit', 'cash in', 'lodgement', 'cash lodgement', 'deposit cash', 'cash payment'],
      patterns: [/cash.*deposit/i, /deposit.*cash/i, /lodgement/i, /cash.*in/i]
    },
    'Bank Charges': {
      keywords: ['bank charge', 'service charge', 'fee', 'commission', 'bank fee', 'transaction fee', 'maintenance fee', 'processing fee', 'handling charge'],
      patterns: [/bank.*charge/i, /service.*charge/i, /.*fee$/i, /commission/i, /maintenance.*fee/i]
    },
    'Transfer': {
      keywords: ['transfer', 'juice transfer', 'maubank transfer', 'inter bank', 'fund transfer', 'money transfer'],
      patterns: [/transfer/i, /juice.*transfer/i, /maubank/i, /inter.*bank/i]
    }
  };

  // Check API status on component mount
  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const response = await fetch('/api/debug');
      const data = await response.json();
      
      if (data.apiTestResult?.success) {
        setApiStatus('working');
        addLog('Claude AI enhancement is available and working', 'success');
      } else {
        setApiStatus('error');
        addLog(`AI API issue: ${data.apiTestResult?.error || 'Unknown error'}`, 'warning');
        setAiEnhancementEnabled(false);
      }
    } catch (error) {
      setApiStatus('error');
      addLog('Could not verify AI API status', 'warning');
      setAiEnhancementEnabled(false);
    }
  };

  // Enhanced log function with categorization
  const addLog = (message, type = 'info', details = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { 
      timestamp, 
      message, 
      type, 
      details,
      id: Date.now() + Math.random() 
    };
    setLogs(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 logs
    
    // Console logging with better formatting
    const prefix = `[${type.toUpperCase()}]`;
    const fullMessage = `${prefix} ${message}`;
    
    if (type === 'error') console.error(fullMessage, details);
    else if (type === 'warning') console.warn(fullMessage, details);
    else if (type === 'success') console.info(`✅ ${message}`, details);
    else console.log(fullMessage, details);
  };

  // Enhanced file upload with validation
  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    const pdfFiles = uploadedFiles.filter(file => {
      const isValidPdf = file.type === 'application/pdf';
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit
      
      if (!isValidPdf) {
        addLog(`${file.name}: Invalid file type. Only PDF files are supported.`, 'warning');
        return false;
      }
      
      if (!isValidSize) {
        addLog(`${file.name}: File too large. Maximum size is 50MB.`, 'warning');
        return false;
      }
      
      return true;
    });
    
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
    setLogs(prev => prev.slice(0, 5)); // Keep recent logs but clear processing logs
  };

  // ENHANCED OCR function with Claude AI integration
  const enhanceOCRWithClaude = async (ocrText, imageData = null, isImage = false, pageNumber = 1) => {
    // Skip if AI enhancement is disabled
    if (!aiEnhancementEnabled) {
      addLog(`Page ${pageNumber}: AI enhancement disabled, using direct extraction`, 'info');
      return ocrText;
    }

    // Skip if no meaningful text to enhance
    if (!ocrText || ocrText.trim().length < 20) {
      addLog(`Page ${pageNumber}: Insufficient text for AI enhancement`, 'info');
      return ocrText;
    }

    try {
      addLog(`Page ${pageNumber}: Enhancing text with Claude AI...`, 'info');
      
      const requestBody = {
        ocrText: ocrText,
        imageData: imageData,
        isImage: isImage,
        pageNumber: pageNumber
      };

      const response = await fetch('/api/enhance-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (isImage && data.ocrText) {
        addLog(`Page ${pageNumber}: Claude AI vision processing completed`, 'success');
        return data.ocrText;
      } else if (data.enhancedText) {
        addLog(`Page ${pageNumber}: Claude AI text enhancement completed`, 'success');
        return data.enhancedText;
      } else {
        throw new Error('Invalid response format from AI service');
      }
      
    } catch (error) {
      addLog(`Page ${pageNumber}: AI enhancement failed - ${error.message}`, 'warning');
      addLog(`Page ${pageNumber}: Falling back to original text`, 'info');
      return ocrText; // Graceful fallback
    }
  };

  // Enhanced PDF processing with better error handling
  const processPDF = async (file) => {
    try {
      addLog(`Starting PDF processing: ${file.name}`, 'info');
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allText = '';
      let pageTexts = [];
      let successfulPages = 0;

      addLog(`PDF loaded: ${pdf.numPages} pages found`, 'info');

      // Process each page with enhanced error handling
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        addLog(`Processing page ${pageNum}/${pdf.numPages}...`, 'info');
        
        try {
          const page = await pdf.getPage(pageNum);
          let pageText = '';
          let extractionMethod = 'unknown';
          
          // Method 1: Try direct text extraction first
          try {
            const textContent = await page.getTextContent();
            pageText = textContent.items.map(item => item.str).join(' ');
            extractionMethod = 'direct';
            
            if (pageText && pageText.trim().length > 50) {
              addLog(`Page ${pageNum}: Direct text extraction successful (${pageText.length} chars)`, 'success');
            }
          } catch (directError) {
            addLog(`Page ${pageNum}: Direct text extraction failed`, 'warning');
          }
          
          // Method 2: Use OCR if direct extraction yielded poor results
          if (!pageText || pageText.trim().length < 50) {
            addLog(`Page ${pageNum}: Using OCR for text extraction...`, 'info');
            
            try {
              // Render page to canvas
              const canvas = document.createElement('canvas');
              const canvasContext = canvas.getContext('2d');
              const viewport = page.getViewport({ scale: 2.0 });
              
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              await page.render({
                canvasContext: canvasContext,
                viewport: viewport
              }).promise;
              
              // Convert canvas to base64 for potential AI processing
              const imageData = canvas.toDataURL('image/png').split(',')[1];
              
              // Try AI-powered OCR first if available
              if (aiEnhancementEnabled) {
                try {
                  pageText = await enhanceOCRWithClaude(null, imageData, true, pageNum);
                  extractionMethod = 'ai-vision';
                  addLog(`Page ${pageNum}: AI vision OCR completed`, 'success');
                } catch (aiError) {
                  addLog(`Page ${pageNum}: AI vision failed, trying Tesseract`, 'warning');
                  // Fall back to Tesseract
                }
              }
              
              // Tesseract fallback if AI failed or is disabled
              if (!pageText || pageText.trim().length < 20) {
                const ocrResult = await Tesseract.recognize(canvas, 'eng', {
                  logger: m => {
                    if (m.status === 'recognizing text') {
                      addLog(`OCR progress: ${Math.round(m.progress * 100)}%`, 'info');
                    }
                  }
                });
                pageText = ocrResult.data.text;
                extractionMethod = 'tesseract';
                addLog(`Page ${pageNum}: Tesseract OCR completed`, 'success');
              }
              
            } catch (ocrError) {
              addLog(`Page ${pageNum}: OCR failed - ${ocrError.message}`, 'error');
              pageText = `[Page ${pageNum}: Text extraction failed - ${ocrError.message}]`;
              extractionMethod = 'failed';
            }
          }
          
          // Method 3: Enhance text with AI if we have content
          if (pageText && pageText.trim().length > 20 && extractionMethod !== 'ai-vision') {
            try {
              const enhancedText = await enhanceOCRWithClaude(pageText, null, false, pageNum);
              if (enhancedText && enhancedText !== pageText) {
                pageText = enhancedText;
                extractionMethod = extractionMethod + '+ai';
              }
            } catch (enhanceError) {
              // Enhancement failure is not critical, continue with original text
              addLog(`Page ${pageNum}: Text enhancement failed, using original`, 'info');
            }
          }
          
          pageTexts.push({
            pageNumber: pageNum,
            text: pageText,
            method: extractionMethod,
            length: pageText.length
          });
          
          allText += pageText + '\n';
          successfulPages++;
          
          addLog(`Page ${pageNum}: Extraction complete (${extractionMethod}, ${pageText.length} chars)`, 'success');
          
        } catch (pageError) {
          addLog(`Page ${pageNum}: Processing failed - ${pageError.message}`, 'error');
          pageTexts.push({
            pageNumber: pageNum,
            text: `[Error processing page ${pageNum}: ${pageError.message}]`,
            method: 'error',
            length: 0
          });
          continue;
        }
      }

      if (successfulPages === 0) {
        throw new Error('No pages could be processed successfully');
      }

      if (!allText.trim()) {
        throw new Error('No text could be extracted from any page');
      }

      addLog(`PDF processing complete: ${file.name} - ${successfulPages}/${pdf.numPages} pages processed, ${allText.length} characters extracted`, 'success');
      
      return {
        text: allText,
        pageDetails: pageTexts,
        successfulPages,
        totalPages: pdf.numPages
      };

    } catch (error) {
      addLog(`PDF processing failed: ${file.name} - ${error.message}`, 'error');
      throw error;
    }
  };

  // Enhanced metadata extraction with AI assistance
  const extractStatementMetadata = async (text, fileName) => {
    const metadata = {
      fileName: fileName,
      accountNumber: null,
      iban: null,
      statementPeriod: null,
      currency: 'MUR',
      openingBalance: 0,
      closingBalance: 0,
      bankName: null,
      accountType: null
    };

    // Enhanced extraction patterns
    const patterns = {
      accountNumber: [
        /account\s*(?:number|no\.?|#)?\s*:?\s*(\d+)/i,
        /a\/c\s*(?:no\.?|number)?\s*:?\s*(\d+)/i,
        /(?:account|a\/c)\s*(\d{8,})/i
      ],
      iban: [
        /IBAN\s*:?\s*([A-Z]{2}\d{2}[A-Z\d]+)/i,
        /International\s+Bank\s+Account\s+Number\s*:?\s*([A-Z]{2}\d{2}[A-Z\d]+)/i
      ],
      bankName: [
        /(mauritius\s+commercial\s+bank|mcb)/i,
        /(state\s+bank|sbm)/i,
        /(barclays)/i,
        /(hsbc)/i,
        /(standard\s+bank)/i
      ],
      statementPeriod: [
        /(?:statement|period|from)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(?:to|until|-)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:to|-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
      ],
      openingBalance: [
        /(?:opening|previous|brought\s+forward|b\/f)\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
        /balance\s+(?:brought\s+)?forward\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
        /previous\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i
      ],
      closingBalance: [
        /(?:closing|final|current)\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
        /balance\s+(?:carried\s+)?forward\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i,
        /current\s+balance\s*:?\s*(?:MUR\s*)?([0-9,]+\.?\d*)/i
      ]
    };

    // Extract each field
    Object.entries(patterns).forEach(([field, fieldPatterns]) => {
      for (const pattern of fieldPatterns) {
        const match = text.match(pattern);
        if (match) {
          switch (field) {
            case 'accountNumber':
            case 'iban':
              metadata[field] = match[1];
              break;
            case 'bankName':
              metadata[field] = match[1];
              break;
            case 'statementPeriod':
              metadata[field] = `${match[1]} to ${match[2]}`;
              break;
            case 'openingBalance':
            case 'closingBalance':
              metadata[field] = parseFloat(match[1].replace(/,/g, '')) || 0;
              break;
          }
          break; // Use first match
        }
      }
    });

    return metadata;
  };

  // Enhanced transaction extraction with AI-powered parsing
  const extractTransactions = async (text, fileName) => {
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Multiple transaction patterns for different bank formats
    const transactionPatterns = [
      // Standard format: Date ValueDate Description Amount Balance
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})?\s*(.+?)\s+([+-]?\d{1,3}(?:,\d{3})*\.?\d*)\s+([+-]?\d{1,3}(?:,\d{3})*\.?\d*)$/,
      // Alternative format: Date Description Amount Balance
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([+-]?\d{1,3}(?:,\d{3})*\.?\d*)\s+([+-]?\d{1,3}(?:,\d{3})*\.?\d*)$/,
      // DD-MM-YYYY format
      /(\d{1,2}-\d{1,2}-\d{4})\s+(\d{1,2}-\d{1,2}-\d{4})?\s*(.+?)\s+([+-]?\d{1,3}(?:,\d{3})*\.?\d*)\s+([+-]?\d{1,3}(?:,\d{3})*\.?\d*)$/
    ];
    
    let transactionCounter = 0;

    for (const line of lines) {
      let matched = false;
      
      for (const pattern of transactionPatterns) {
        const match = line.match(pattern);
        if (match) {
          transactionCounter++;
          
          let transactionDate, valueDate, description, amountStr, balanceStr;
          
          if (match.length === 6) {
            // Format with value date
            [, transactionDate, valueDate, description, amountStr, balanceStr] = match;
            valueDate = valueDate || transactionDate;
          } else {
            // Format without value date
            [, transactionDate, description, amountStr, balanceStr] = match;
            valueDate = transactionDate;
          }

          // Clean and parse amounts
          const cleanAmount = amountStr.replace(/[,\s]/g, '');
          const cleanBalance = balanceStr.replace(/[,\s]/g, '');
          
          const amount = Math.abs(parseFloat(cleanAmount));
          const balance = parseFloat(cleanBalance);
          
          // Determine if it's a debit
          const isDebit = cleanAmount.includes('-') || 
                          description.toLowerCase().includes('withdrawal') || 
                          description.toLowerCase().includes('charge') ||
                          description.toLowerCase().includes('fee');

          // Clean description
          description = description.replace(/\s+/g, ' ').trim();

          if (!isNaN(amount) && !isNaN(balance) && amount > 0) {
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
          
          matched = true;
          break;
        }
      }
      
      if (!matched && line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/) && line.match(/\d+/)) {
        // Potential transaction line that didn't match patterns
        addLog(`Potential missed transaction: ${line.substring(0, 100)}...`, 'warning');
      }
    }

    addLog(`Extracted ${transactions.length} transactions from ${fileName}`, transactions.length > 0 ? 'success' : 'warning');
    return transactions;
  };

  // Enhanced categorization with pattern matching and confidence scoring
  const categorizeTransaction = (transaction) => {
    const description = transaction.description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [category, config] of Object.entries(categoryMapping)) {
      let score = 0;
      let matchedItem = null;
      
      // Check exact keyword matches (higher weight)
      for (const keyword of config.keywords) {
        if (description.includes(keyword.toLowerCase())) {
          score += 3;
          matchedItem = keyword;
          break;
        }
      }
      
      // Check pattern matches (medium weight)
      if (config.patterns) {
        for (const pattern of config.patterns) {
          if (pattern.test(description)) {
            score += 2;
            if (!matchedItem) matchedItem = pattern.toString();
          }
        }
      }
      
      // Fuzzy matching for similar words (low weight)
      for (const keyword of config.keywords) {
        const similarity = calculateSimilarity(description, keyword.toLowerCase());
        if (similarity > 0.7) {
          score += 1;
          if (!matchedItem) matchedItem = `~${keyword}`;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          category,
          matchedKeyword: matchedItem,
          confidence: Math.min(score / 3, 1.0) // Normalize to 0-1
        };
      }
    }
    
    // Require minimum confidence threshold
    if (bestMatch && bestMatch.confidence >= 0.6) {
      return bestMatch;
    }
    
    return null; // No confident match found
  };

  // Simple similarity calculation
  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1, str2) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  // Main processing function with enhanced error handling and progress tracking
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
      addLog(`🚀 Starting processing of ${files.length} file(s)...`, 'info');
      addLog(`AI Enhancement: ${aiEnhancementEnabled ? 'Enabled' : 'Disabled'}`, 'info');
      
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        
        try {
          addLog(`📄 Processing file ${fileIndex + 1}/${files.length}: ${file.name}`, 'info');
          
          // Extract text from PDF with detailed progress
          const extractionResult = await processPDF(file);
          const extractedText = extractionResult.text;
          
          // Extract metadata with AI enhancement
          addLog(`🔍 Extracting metadata from ${file.name}...`, 'info');
          const metadata = await extractStatementMetadata(extractedText, file.name);
          newStatementMetadata[file.name] = metadata;
          
          // Extract transactions with enhanced parsing
          addLog(`💰 Extracting transactions from ${file.name}...`, 'info');
          const transactions = await extractTransactions(extractedText, file.name);
          
          if (transactions.length === 0) {
            addLog(`⚠️ No transactions found in ${file.name}. This might indicate a parsing issue.`, 'warning');
            newFileStats[file.name] = {
              status: 'warning',
              message: 'No transactions extracted',
              total: 0,
              categorized: 0,
              uncategorized: 0,
              successRate: 0
            };
            continue;
          }
          
          addLog(`✅ Extracted ${transactions.length} transactions from ${file.name}`, 'success');
          
          // Categorize transactions with confidence tracking
          addLog(`🏷️ Categorizing transactions from ${file.name}...`, 'info');
          let categorized = 0;
          let uncategorized = 0;
          let highConfidenceCount = 0;
          
          for (const transaction of transactions) {
            const categoryResult = categorizeTransaction(transaction);
            
            if (categoryResult) {
              transaction.category = categoryResult.category;
              transaction.matchedKeyword = categoryResult.matchedKeyword;
              transaction.confidence = categoryResult.confidence;
              
              newResults[categoryResult.category].push(transaction);
              categorized++;
              
              if (categoryResult.confidence > 0.8) {
                highConfidenceCount++;
              }
            } else {
              transaction.category = 'Uncategorized';
              transaction.reason = 'No matching pattern found';
              newUncategorized.push(transaction);
              uncategorized++;
            }
          }
          
          // Store detailed file statistics
          newFileStats[file.name] = {
            status: 'success',
            total: transactions.length,
            categorized: categorized,
            uncategorized: uncategorized,
            successRate: transactions.length > 0 ? ((categorized / transactions.length) * 100).toFixed(1) : 0,
            highConfidenceCount,
            extractionDetails: extractionResult.pageDetails,
            metadata: metadata
          };

          newCounters[file.name] = { processed: transactions.length };
          
          addLog(`✅ ${file.name}: ${categorized} categorized (${highConfidenceCount} high confidence), ${uncategorized} uncategorized`, 'success');
          
        } catch (fileError) {
          addLog(`❌ Failed to process ${file.name}: ${fileError.message}`, 'error');
          newFileStats[file.name] = {
            status: 'error',
            error: fileError.message,
            total: 0,
            categorized: 0,
            uncategorized: 0
          };
        }
      }

      // Update state with all results
      setResults(newResults);
      setUncategorizedData(newUncategorized);
      setFileStats(newFileStats);
      setStatementMetadata(newStatementMetadata);
      setDocumentCounters(newCounters);

      // Calculate final statistics
      const totalTransactions = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0) + newUncategorized.length;
      const totalCategorized = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0);
      const successRate = totalTransactions > 0 ? ((totalCategorized / totalTransactions) * 100).toFixed(1) : 0;
      const highConfidenceTransactions = Object.values(newResults).flat().filter(t => t.confidence > 0.8).length;
      
      addLog(`🎉 Processing complete!`, 'success');
      addLog(`📊 Summary: ${totalTransactions} total transactions, ${totalCategorized} categorized (${successRate}%), ${highConfidenceTransactions} high confidence`, 'success');
      
      if (newUncategorized.length > 0) {
        addLog(`⚠️ ${newUncategorized.length} transactions need manual review`, 'warning');
      }
      
    } catch (error) {
      addLog(`💥 Processing failed: ${error.message}`, 'error');
      console.error('Processing error:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Enhanced export with grouping
  const handleExportWithGrouping = async (groupingConfig) => {
    if (!results || Object.keys(results).length === 0) {
      addLog('No data to export', 'error');
      return;
    }

    try {
      setProcessing(true);
      addLog('🚀 Starting Excel export...', 'info');
      
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
      
      addLog('✅ Excel export completed successfully!', 'success');
    } catch (error) {
      addLog(`❌ Export failed: ${error.message}`, 'error');
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
    <div className="min-h-screen bg-gradient-from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Enhanced Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="relative">
              <FileText className="h-8 w-8 text-blue-600" />
              {apiStatus === 'working' && (
                <Zap className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">AI-Powered Bank Statement Processor</h1>
          </div>
          <p className="text-lg text-gray-600">
            Advanced transaction categorization with Claude AI enhancement
          </p>
          
          {/* API Status Indicator */}
          <div className="mt-4 inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm">
            {apiStatus === 'working' ? (
              <>
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700">AI Enhancement Active</span>
              </>
            ) : apiStatus === 'error' ? (
              <>
                <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                <span className="text-yellow-700">AI Enhancement Limited</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600">Checking AI Status...</span>
              </>
            )}
          </div>
        </div>

        {/* Enhanced File Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Upload Bank Statements</h2>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aiEnhancementEnabled}
                    onChange={(e) => setAiEnhancementEnabled(e.target.checked)}
                    disabled={apiStatus !== 'working'}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className={apiStatus === 'working' ? 'text-gray-700' : 'text-gray-400'}>
                    AI Enhancement {apiStatus !== 'working' && '(Unavailable)'}
                  </span>
                </label>
                <div className="text-sm text-gray-500">
                  Supports PDF files • Max 50MB each
                </div>
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
                    Select one or more PDF bank statement files (up to 50MB each)
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Selected Files Display */}
            {files.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Selected Files ({files.length})</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center space-x-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        <div className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • Last modified: {new Date(file.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Mode Selection */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-700 mb-3">Export Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer ${exportMode === 'combined' ? 'border-blue-500 bg-blue-50' : ''}`}>
                  <input
                    type="radio"
                    value="combined"
                    checked={exportMode === 'combined'}
                    onChange={(e) => setExportMode(e.target.value)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-800">Combined Workbook</div>
                    <div className="text-sm text-gray-600">Single Excel file with multiple sheets</div>
                  </div>
                </label>
                
                <label className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer ${exportMode === 'separate' ? 'border-blue-500 bg-blue-50' : ''}`}>
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

            {/* Enhanced Process Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">{showLogs ? 'Hide' : 'Show'} Processing Logs</span>
                  {logs.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                      {logs.length}
                    </span>
                  )}
                </button>
              </div>
              
              <button
                onClick={processFiles}
                disabled={files.length === 0 || processing}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2 shadow-md"
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
                    {aiEnhancementEnabled && <Zap className="h-4 w-4" />}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Processing Logs */}
        {showLogs && logs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Processing Logs</h3>
              <button
                onClick={() => setLogs([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Logs
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {logs.map((log, index) => (
                <div
                  key={log.id || index}
                  className={`p-3 rounded-lg text-sm transition-all duration-200 ${
                    log.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                    log.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                    log.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                    'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="font-mono text-xs text-gray-500 mr-2">{log.timestamp}</span>
                      <span>{log.message}</span>
                    </div>
                    {log.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />}
                    {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />}
                  </div>
                  {log.details && (
                    <div className="mt-2 text-xs font-mono text-gray-600 bg-gray-100 p-2 rounded">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
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

        {/* Enhanced Processing Status */}
        {processing && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border-2 border-blue-200 p-4 flex items-center space-x-3 min-w-0 max-w-sm">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-gray-800 font-medium">Processing documents...</div>
              <div className="text-sm text-gray-600">
                {aiEnhancementEnabled ? 'Using AI enhancement' : 'Standard processing'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankStatementProcessor;
