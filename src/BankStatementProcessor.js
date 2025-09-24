import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Eye, Settings, Zap, XCircle, FileWarning, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import EnhancedResultsDisplay from './components/EnhancedResultsDisplay';
import SimpleGroupingControls from './components/SimpleGroupingControls';
import { generateExcelReport } from './utils/excelExport';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const BankStatementProcessor = () => {
  // State management
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [results, setResults] = useState({});
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [statementMetadata, setStatementMetadata] = useState({});
  const [logs, setLogs] = useState([]);
  const [exportMode, setExportMode] = useState('combined');
  const [showLogs, setShowLogs] = useState(true);
  const [aiEnhancementEnabled, setAiEnhancementEnabled] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [debugMode, setDebugMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Enhanced MCB-specific categorization mapping with all transaction types
  const categoryMapping = {
    'CSG/PRGF': {
      keywords: ['csg', 'prgf', 'direct debit scheme', 'mauritius revenue authority', 'mra'],
      patterns: [/direct\s+debit.*mauritius\s+revenue/i, /mra.*csg/i]
    },
    'Prime (Scheme)': {
      keywords: ['prime scheme', 'interbank transfer mra', 'paer'],
      patterns: [/prime.*scheme/i, /mra.*paer/i]
    },
    'Consultancy Fee': {
      keywords: ['consultancy', 'professional fee', 'advisory', 'consulting'],
      patterns: [/consultancy\s+fee/i, /professional.*service/i]
    },
    'Salary': {
      keywords: ['salary', 'wage', 'payroll', 'staff payment', 'salary credit'],
      patterns: [/salary/i, /wage\s+payment/i, /payroll/i]
    },
    'Purchase/Payment': {
      keywords: ['purchase', 'payment', 'merchant', 'pos', 'shop', 'store'],
      patterns: [/purchase/i, /merchant.*payment/i, /pos\s+transaction/i]
    },
    'Sales': {
      keywords: ['sales', 'revenue', 'income', 'receipt', 'collection'],
      patterns: [/sales/i, /revenue.*collection/i, /income/i]
    },
    'Cash Withdrawal': {
      keywords: ['atm', 'cash withdrawal', 'withdraw', 'retrait'],
      patterns: [/atm.*withdrawal/i, /cash.*withdrawal/i, /retrait/i]
    },
    'Cash Deposit': {
      keywords: ['deposit', 'cash deposit', 'versement', 'credit deposit'],
      patterns: [/cash.*deposit/i, /deposit/i, /versement/i]
    },
    'Cash Cheque': {
      keywords: ['cash cheque', 'cheque', 'check'],
      patterns: [/cash\s+cheque/i, /cheque\s+\d+/i, /TT\d+/i]
    },
    'Bank Charges': {
      keywords: ['charge', 'fee', 'commission', 'frais', 'vat'],
      patterns: [/bank.*charge/i, /fee/i, /commission/i, /frais/i]
    },
    'Refill/Top-up': {
      keywords: ['refill amount', 'refill', 'top up', 'topup', 'recharge'],
      patterns: [/refill\s+amount/i, /FT\d+.*\d+/i]
    },
    'Transfer': {
      keywords: ['transfer', 'virement', 'iban', 'swift', 'juicepro', 'interbank'],
      patterns: [/transfer/i, /virement/i, /iban/i, /juicepro/i, /interbank/i]
    },
    'Transfer In': {
      keywords: ['transfer in', 'incoming transfer', 'received transfer', 'credit transfer'],
      patterns: [/transfer.*in/i, /incoming.*transfer/i, /credit.*transfer/i]
    },
    'Interest Earned': {
      keywords: ['interest', 'interest earned', 'interest credit'],
      patterns: [/interest.*earned/i, /interest.*credit/i]
    }
  };

  // Check API status on mount - UPDATED WITH BETTER ERROR HANDLING
  useEffect(() => {
    checkAPIStatus();
  }, []);

  const checkAPIStatus = async () => {
    try {
      setCurrentStep('Checking Claude API status...');
      
      // Use the correct URL based on environment
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/debug'
        : '/api/debug';
      
      console.log('Checking API status at:', apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      console.log('API Status Response:', data); // Debug logging
      
      if (data.apiTestResult?.status === 'SUCCESS') {
        setApiStatus('working');
        setAiEnhancementEnabled(true);
        addLog('✅ Claude AI enhancement is available', 'success');
        console.log('AI Enhancement enabled successfully');
      } else {
        setApiStatus('error');
        addLog(`⚠️ AI unavailable: ${data.apiTestResult?.error || 'Will use OCR'}`, 'warning');
        setAiEnhancementEnabled(false);
        console.log('AI Enhancement not available:', data.apiTestResult);
      }
    } catch (error) {
      console.error('API Status Check Error:', error);
      setApiStatus('error');
      addLog('⚠️ AI unavailable - using fallback OCR', 'warning');
      setAiEnhancementEnabled(false);
    }
    setCurrentStep('');
  };

  // Enhanced logging
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { 
      timestamp, 
      message, 
      type,
      id: Date.now() + Math.random() 
    };
    setLogs(prev => [logEntry, ...prev.slice(0, 99)]);
  };

  // File upload handler
  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    const pdfFiles = uploadedFiles.filter(file => {
      if (file.type !== 'application/pdf') {
        addLog(`❌ ${file.name}: Not a PDF file`, 'error');
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        addLog(`❌ ${file.name}: File too large (max 50MB)`, 'error');
        return false;
      }
      return true;
    });

    setFiles(pdfFiles);
    setResults({});
    setUncategorizedData([]);
    setFileStats({});
    setStatementMetadata({});
    setValidationErrors({});
    addLog(`📁 ${pdfFiles.length} PDF file(s) selected`, 'success');
  };

  // MCB Document Validation
  const validateMCBDocument = (text, fileName) => {
    addLog(`🔍 Validating ${fileName} as MCB document...`, 'info');
    
    const mcbIndicators = [
      'mauritius commercial bank',
      'mcb',
      'mcb.mu',
      'the mauritius commercial bank ltd',
      'mcb ltd'
    ];

    const textLower = text.toLowerCase();
    const isMCB = mcbIndicators.some(indicator => textLower.includes(indicator));

    if (!isMCB) {
      addLog(`❌ ${fileName}: Not an MCB document`, 'error');
      setValidationErrors(prev => ({
        ...prev,
        [fileName]: 'This is not an MCB bank statement. Please upload only MCB statements.'
      }));
      return false;
    }

    addLog(`✅ ${fileName}: Valid MCB document`, 'success');
    return true;
  };

  // Extract text with AI enhancement - UPDATED WITH BETTER API HANDLING
  const enhanceOCRWithClaude = async (ocrText, imageData = null, isImage = false, pageNumber = 1) => {
    if (!aiEnhancementEnabled) {
      console.log('AI enhancement disabled, returning original text');
      return ocrText;
    }

    try {
      const requestBody = {
        ocrText: ocrText,
        imageData: imageData,
        isImage: isImage,
        pageNumber: pageNumber
      };

      // Use the correct URL based on environment
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/enhance-ocr'
        : '/api/enhance-ocr';

      console.log('Calling enhance API:', apiUrl);
      console.log('Request type:', isImage ? 'Image OCR' : 'Text Enhancement');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Enhance API Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(`API error: ${response.status} - ${errorData.message}`);
      }

      const data = await response.json();
      console.log('Enhancement successful, method:', data.method);
      
      if (isImage && data.ocrText) {
        addLog(`✅ AI Vision OCR completed for page ${pageNumber}`, 'success');
        return data.ocrText;
      } else if (data.enhancedText) {
        addLog(`✅ AI text enhancement completed for page ${pageNumber}`, 'success');
        return data.enhancedText;
      }
      
      return ocrText;
    } catch (error) {
      console.error('Enhancement error:', error);
      addLog(`⚠️ AI enhancement failed: ${error.message}`, 'warning');
      return ocrText;
    }
  };

  // Process PDF file
  const processPDF = async (file) => {
    try {
      addLog(`📄 Processing: ${file.name}`, 'info');
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allText = '';
      let pageTexts = [];

      addLog(`📄 Found ${pdf.numPages} pages`, 'info');

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setCurrentStep(`Processing page ${pageNum}/${pdf.numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        let pageText = '';
        
        // Try direct text extraction
        try {
          const textContent = await page.getTextContent();
          pageText = textContent.items.map(item => item.str).join(' ');
        } catch (error) {
          addLog(`Page ${pageNum}: Direct extraction failed`, 'warning');
        }
        
        // If no text or too short, use OCR
        if (!pageText || pageText.trim().length < 50) {
          addLog(`Page ${pageNum}: Using OCR...`, 'info');
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          const viewport = page.getViewport({ scale: 2.0 });
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          if (aiEnhancementEnabled) {
            const imageData = canvas.toDataURL('image/png').split(',')[1];
            pageText = await enhanceOCRWithClaude(null, imageData, true, pageNum);
            addLog(`Page ${pageNum}: AI OCR complete`, 'success');
          } else {
            const result = await Tesseract.recognize(canvas, 'eng');
            pageText = result.data.text;
            addLog(`Page ${pageNum}: Tesseract OCR complete`, 'success');
          }
        } else if (aiEnhancementEnabled && pageText) {
          // Enhance extracted text with AI
          pageText = await enhanceOCRWithClaude(pageText, null, false, pageNum);
        }
        
        pageTexts.push({ pageNumber: pageNum, text: pageText });
        allText += pageText + '\n';
      }

      return { text: allText, pageDetails: pageTexts };
    } catch (error) {
      addLog(`❌ Failed to process ${file.name}: ${error.message}`, 'error');
      throw error;
    }
  };

  // Extract metadata (opening/closing balances)
  const extractStatementMetadata = (text, fileName) => {
    const metadata = {
      fileName: fileName,
      accountNumber: null,
      statementPeriod: null,
      currency: 'MUR',
      openingBalance: 0,
      closingBalance: 0,
      bankName: 'Mauritius Commercial Bank'
    };

    // Extract account number
    const accountMatch = text.match(/account\s*(?:number|no)?[:\s]*(\d{10,})/i);
    if (accountMatch) {
      metadata.accountNumber = accountMatch[1];
      addLog(`Found account: ${accountMatch[1]}`, 'info');
    }

    // Extract statement period
    const periodMatch = text.match(/(?:period|from)\s*[:]*\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (periodMatch) {
      metadata.statementPeriod = `${periodMatch[1]} to ${periodMatch[2]}`;
      addLog(`Found period: ${metadata.statementPeriod}`, 'info');
    }

    // Extract opening balance - Multiple patterns
    const openingPatterns = [
      /opening\s*balance[:\s]*([\d,]+\.?\d*)/i,
      /balance\s*brought\s*forward[:\s]*([\d,]+\.?\d*)/i,
      /solde\s*initial[:\s]*([\d,]+\.?\d*)/i,
      /balance\s*b\/f[:\s]*([\d,]+\.?\d*)/i
    ];

    for (const pattern of openingPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.openingBalance = parseFloat(match[1].replace(/,/g, '')) || 0;
        addLog(`Found opening balance: MUR ${metadata.openingBalance.toLocaleString()}`, 'success');
        break;
      }
    }

    // Extract closing balance - Multiple patterns
    const closingPatterns = [
      /closing\s*balance[:\s]*([\d,]+\.?\d*)/i,
      /balance\s*carried\s*forward[:\s]*([\d,]+\.?\d*)/i,
      /solde\s*final[:\s]*([\d,]+\.?\d*)/i,
      /balance\s*c\/f[:\s]*([\d,]+\.?\d*)/i,
      /end\s*balance[:\s]*([\d,]+\.?\d*)/i
    ];

    for (const pattern of closingPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.closingBalance = parseFloat(match[1].replace(/,/g, '')) || 0;
        addLog(`Found closing balance: MUR ${metadata.closingBalance.toLocaleString()}`, 'success');
        break;
      }
    }

    return metadata;
  };

  // Helper function to identify likely credit transactions
  const isLikelyCredit = (description) => {
    const creditIndicators = [
      'deposit', 'credit', 'transfer in', 'received', 'interest', 
      'salary', 'payment received', 'refund', 'reversal', 'dividend',
      'incoming', 'collection', 'receipt', 'lodgement'
    ];
    
    return creditIndicators.some(indicator => description.includes(indicator));
  };

  // Extract transactions with FIXED debit/credit detection
  const extractTransactions = (text, fileName) => {
    const transactions = [];
    let transactionCounter = 0;

    // Clean the text
    let cleanedText = text
      .replace(/Page\s*:\s*\d+\s*of\s*\d+/gi, '')
      .replace(/The\s+Mauritius\s+Commercial\s+Bank.*?Website.*?mcb\.mu/gis, '');

    // Extract opening balance as reference point
    let currentBalance = 0;
    const openingMatch = text.match(/opening\s*balance[:\s]*([\d,]+\.?\d*)/i) ||
                         text.match(/balance\s*brought\s*forward[:\s]*([\d,]+\.?\d*)/i);
    if (openingMatch) {
      currentBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
      addLog(`Starting balance for transaction detection: MUR ${currentBalance.toLocaleString()}`, 'info');
    } else if (statementMetadata[fileName]?.openingBalance) {
      currentBalance = statementMetadata[fileName].openingBalance;
      addLog(`Using metadata opening balance: MUR ${currentBalance.toLocaleString()}`, 'info');
    }

    // Multiple transaction patterns for MCB
    const patterns = [
      // Pattern 1: Date Date Amount Balance Description
      {
        regex: /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+([\d,]+\.?\d{2})\s+([\d,]+\.?\d{2})\s+(.+?)(?=\d{2}[\/\-]\d{2}[\/\-]\d{4}|Opening|Closing|$)/g,
        type: 'amount-balance-desc'
      },
      // Pattern 2: Date Date Description Amount Balance
      {
        regex: /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+([A-Z][^0-9]+?)\s+([\d,]+\.?\d{2})\s+([\d,]+\.?\d{2})/g,
        type: 'desc-amount-balance'
      },
      // Pattern 3: Date Date Description Debit Credit Balance
      {
        regex: /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(.+?)\s+([\d,]+\.?\d{2})?\s+([\d,]+\.?\d{2})?\s+([\d,]+\.?\d{2})\s*$/gm,
        type: 'debit-credit-columns'
      }
    ];

    // Try each pattern
    for (const pattern of patterns) {
      let match;
      
      while ((match = pattern.regex.exec(cleanedText)) !== null) {
        transactionCounter++;
        
        let transaction = {
          transactionDate: match[1],
          valueDate: match[2],
          description: '',
          amount: 0,
          balance: 0,
          isDebit: true,
          sourceFile: fileName,
          transactionId: `${fileName}_${transactionCounter}`
        };

        if (pattern.type === 'amount-balance-desc') {
          transaction.amount = parseFloat(match[3].replace(/,/g, ''));
          transaction.balance = parseFloat(match[4].replace(/,/g, ''));
          transaction.description = match[5].trim();
        } else if (pattern.type === 'desc-amount-balance') {
          transaction.description = match[3].trim();
          transaction.amount = parseFloat(match[4].replace(/,/g, ''));
          transaction.balance = parseFloat(match[5].replace(/,/g, ''));
        } else if (pattern.type === 'debit-credit-columns') {
          transaction.description = match[3].trim();
          const debitAmount = match[4] ? parseFloat(match[4].replace(/,/g, '')) : 0;
          const creditAmount = match[5] ? parseFloat(match[5].replace(/,/g, '')) : 0;
          transaction.balance = parseFloat(match[6].replace(/,/g, ''));
          
          if (creditAmount > 0) {
            transaction.amount = creditAmount;
            transaction.isDebit = false;
          } else if (debitAmount > 0) {
            transaction.amount = debitAmount;
            transaction.isDebit = true;
          } else {
            // If both are 0, use balance comparison
            transaction.amount = Math.abs(transaction.balance - currentBalance);
          }
        }

        // CRITICAL FIX: Determine debit/credit based on balance change
        if (pattern.type !== 'debit-credit-columns' || (match[4] === undefined && match[5] === undefined)) {
          if (currentBalance > 0) {
            if (transaction.balance > currentBalance) {
              // Balance increased = CREDIT (money came in)
              transaction.isDebit = false;
              if (debugMode) {
                addLog(`Credit: ${transaction.description.substring(0, 30)}... Balance: ${currentBalance.toFixed(2)} → ${transaction.balance.toFixed(2)}`, 'info');
              }
            } else if (transaction.balance < currentBalance) {
              // Balance decreased = DEBIT (money went out)
              transaction.isDebit = true;
              if (debugMode) {
                addLog(`Debit: ${transaction.description.substring(0, 30)}... Balance: ${currentBalance.toFixed(2)} → ${transaction.balance.toFixed(2)}`, 'info');
              }
            } else {
              // Balance unchanged - check description
              const desc = transaction.description.toLowerCase();
              transaction.isDebit = !isLikelyCredit(desc);
            }
          } else {
            // First transaction - compare with opening balance if available
            const openingBal = statementMetadata[fileName]?.openingBalance || 0;
            if (openingBal > 0) {
              transaction.isDebit = transaction.balance < openingBal;
            } else {
              // Fallback to description analysis
              const desc = transaction.description.toLowerCase();
              transaction.isDebit = !isLikelyCredit(desc);
            }
          }
        }

        // Update current balance for next comparison
        if (transaction.balance > 0) {
          currentBalance = transaction.balance;
        }

        if (transaction.amount > 0) {
          transactions.push(transaction);
        }
      }
      
      if (transactions.length > 0) {
        break; // Use first successful pattern
      }
    }

    // Sort transactions by date
    transactions.sort((a, b) => {
      const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
      const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
      return dateA - dateB;
    });

    // Final validation pass - ensure debit/credit logic is correct
    if (transactions.length > 0) {
      let prevBalance = statementMetadata[fileName]?.openingBalance || 0;
      
      transactions.forEach((trans, index) => {
        if (prevBalance > 0) {
          // Double-check: did balance go up or down?
          if (trans.balance > prevBalance) {
            trans.isDebit = false; // Definitely a credit
          } else if (trans.balance < prevBalance) {
            trans.isDebit = true;  // Definitely a debit
          }
        }
        prevBalance = trans.balance;
      });
    }

    // Log summary
    const debits = transactions.filter(t => t.isDebit).length;
    const credits = transactions.filter(t => !t.isDebit).length;
    const totalDebits = transactions.filter(t => t.isDebit).reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = transactions.filter(t => !t.isDebit).reduce((sum, t) => sum + t.amount, 0);
    
    addLog(`Extracted ${transactions.length} transactions from ${fileName}`, 
          transactions.length > 0 ? 'success' : 'warning');
    addLog(`Summary: ${debits} debits (MUR ${totalDebits.toLocaleString()}), ${credits} credits (MUR ${totalCredits.toLocaleString()})`, 'info');
    
    if (debugMode && transactions.length === 0) {
      addLog('DEBUG: Sample text for inspection:', 'info');
      addLog(cleanedText.substring(0, 500), 'info');
    }

    return transactions;
  };

  // Enhanced categorization with credit/debit awareness
  const categorizeTransaction = (transaction) => {
    const description = transaction.description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    // Special handling for credit transactions
    if (!transaction.isDebit) {
      // Credit-specific categorization
      if (description.includes('salary') || description.includes('wage')) {
        return { category: 'Salary', confidence: 0.95 };
      }
      if (description.includes('transfer') && (description.includes('in') || description.includes('received'))) {
        return { category: 'Transfer In', confidence: 0.9 };
      }
      if (description.includes('deposit')) {
        return { category: 'Cash Deposit', confidence: 0.9 };
      }
      if (description.includes('interest')) {
        return { category: 'Interest Earned', confidence: 0.9 };
      }
      if (description.includes('refund') || description.includes('reversal')) {
        return { category: 'Refund', confidence: 0.9 };
      }
    }
    
    // Check all categories
    for (const [category, config] of Object.entries(categoryMapping)) {
      let score = 0;
      
      // Check keywords
      for (const keyword of config.keywords) {
        if (description.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }
      
      // Check patterns
      for (const pattern of config.patterns) {
        if (pattern.test(description)) {
          score += 3;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { category, confidence: Math.min(score / 5, 1.0) };
      }
    }
    
    return bestMatch && bestMatch.confidence >= 0.4 ? bestMatch : null;
  };

  // Main processing function
  const processFiles = async () => {
    if (files.length === 0) {
      addLog('❌ No files selected', 'error');
      return;
    }

    setProcessing(true);
    setCurrentStep('Starting processing...');
    
    const newResults = {};
    const newUncategorized = [];
    const newFileStats = {};
    const newStatementMetadata = {};

    // Initialize categories
    Object.keys(categoryMapping).forEach(category => {
      newResults[category] = [];
    });
    // Add Refund category if not in mapping
    if (!newResults['Refund']) {
      newResults['Refund'] = [];
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentStep(`Processing ${file.name} (${i + 1}/${files.length})`);
        
        try {
          // Extract text
          const extractionResult = await processPDF(file);
          
          // Validate MCB document
          if (!validateMCBDocument(extractionResult.text, file.name)) {
            newFileStats[file.name] = {
              status: 'error',
              error: 'Not an MCB bank statement',
              total: 0,
              categorized: 0,
              uncategorized: 0
            };
            continue;
          }
          
          // Extract metadata FIRST (important for transaction detection)
          const metadata = extractStatementMetadata(extractionResult.text, file.name);
          newStatementMetadata[file.name] = metadata;
          setStatementMetadata(prev => ({ ...prev, [file.name]: metadata })); // Update state immediately
          
          // Extract transactions (will use metadata for balance comparison)
          const transactions = extractTransactions(extractionResult.text, file.name);
          
          // Categorize transactions
          let categorized = 0;
          let uncategorized = 0;
          
          for (const transaction of transactions) {
            const categoryResult = categorizeTransaction(transaction);
            
            if (categoryResult) {
              transaction.category = categoryResult.category;
              transaction.confidence = categoryResult.confidence;
              if (!newResults[categoryResult.category]) {
                newResults[categoryResult.category] = [];
              }
              newResults[categoryResult.category].push(transaction);
              categorized++;
            } else {
              transaction.category = 'Uncategorized';
              transaction.reason = 'No matching pattern';
              newUncategorized.push(transaction);
              uncategorized++;
            }
          }
          
          // Calculate actual debits and credits
          const totalDebits = transactions.filter(t => t.isDebit).reduce((sum, t) => sum + t.amount, 0);
          const totalCredits = transactions.filter(t => !t.isDebit).reduce((sum, t) => sum + t.amount, 0);
          
          newFileStats[file.name] = {
            status: 'success',
            total: transactions.length,
            categorized: categorized,
            uncategorized: uncategorized,
            totalDebits: totalDebits,
            totalCredits: totalCredits,
            debitCount: transactions.filter(t => t.isDebit).length,
            creditCount: transactions.filter(t => !t.isDebit).length,
            successRate: transactions.length > 0 ? ((categorized / transactions.length) * 100).toFixed(1) : 0,
            metadata: metadata
          };
          
          addLog(`📊 ${file.name} Summary: Debits: MUR ${totalDebits.toLocaleString()} (${newFileStats[file.name].debitCount}), Credits: MUR ${totalCredits.toLocaleString()} (${newFileStats[file.name].creditCount})`, 'success');
          
        } catch (error) {
          addLog(`❌ Failed: ${file.name}: ${error.message}`, 'error');
          newFileStats[file.name] = {
            status: 'error',
            error: error.message,
            total: 0,
            categorized: 0,
            uncategorized: 0
          };
        }
      }

      setResults(newResults);
      setUncategorizedData(newUncategorized);
      setFileStats(newFileStats);
      setStatementMetadata(newStatementMetadata);

      const totalTransactions = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0) + newUncategorized.length;
      const totalCategorized = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0);
      
      addLog(`✅ Processing complete! ${totalTransactions} transactions found`, 'success');
      if (newUncategorized.length > 0) {
        addLog(`⚠️ ${newUncategorized.length} uncategorized transactions need review`, 'warning');
      }
      
    } catch (error) {
      addLog(`❌ Processing failed: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
      setCurrentStep('');
    }
  };

  // Export handler
  const handleExportWithGrouping = async (groupingConfig) => {
    try {
      setProcessing(true);
      await generateExcelReport(
        results,
        uncategorizedData,
        fileStats,
        exportMode,
        {},
        statementMetadata,
        addLog,
        groupingConfig
      );
    } catch (error) {
      addLog(`❌ Export failed: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Calculate totals
  const totalOpeningBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.openingBalance || 0), 0);
  const totalClosingBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.closingBalance || 0), 0);
  const netChange = totalClosingBalance - totalOpeningBalance;

  const hasResults = Object.values(results).some(arr => arr.length > 0) || uncategorizedData.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <FileText className="h-10 w-10 text-blue-600" />
            {apiStatus === 'working' && <Zap className="h-5 w-5 text-yellow-500" />}
          </div>
          <h1 className="text-4xl font-bold text-gray-900">MCB Bank Statement Processor</h1>
          <p className="text-lg text-gray-600 mt-2">
            Convert MCB PDF statements to organized Excel with AI-powered extraction
          </p>
          
          {/* API Status */}
          <div className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white shadow-sm">
            {apiStatus === 'working' ? (
              <>
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-700">AI Enhancement Active</span>
              </>
            ) : apiStatus === 'checking' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-600">Checking AI status...</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                <span className="text-sm text-yellow-700">Using OCR Mode</span>
              </>
            )}
          </div>
        </div>

        {/* Balance Summary (if we have results) */}
        {hasResults && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <DollarSign className="h-6 w-6 mr-2 text-green-600" />
              Financial Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Opening Balance</p>
                    <p className="text-2xl font-bold text-green-800">
                      MUR {totalOpeningBalance.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Closing Balance</p>
                    <p className="text-2xl font-bold text-blue-800">
                      MUR {totalClosingBalance.toLocaleString()}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-blue-500 opacity-20" />
                </div>
              </div>
              
              <div className={`rounded-lg p-4 ${netChange >= 0 ? 'bg-gradient-to-br from-purple-50 to-purple-100' : 'bg-gradient-to-br from-red-50 to-red-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${netChange >= 0 ? 'text-purple-600' : 'text-red-600'}`}>Net Change</p>
                    <p className={`text-2xl font-bold ${netChange >= 0 ? 'text-purple-800' : 'text-red-800'}`}>
                      {netChange >= 0 ? '+' : ''} MUR {netChange.toLocaleString()}
                    </p>
                  </div>
                  {netChange >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-purple-500 opacity-20" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-500 opacity-20" />
                  )}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 font-medium">Documents</p>
                    <p className="text-2xl font-bold text-yellow-800">
                      {Object.keys(fileStats).length}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-yellow-500 opacity-20" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Upload MCB Statements</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <label className="cursor-pointer">
              <span className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-block">
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
            <p className="text-sm text-gray-500 mt-3">
              Upload MCB PDF bank statements (max 50MB each)
            </p>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-700 mb-3">Selected Files</h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium text-gray-800">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {validationErrors[file.name] ? (
                      <div className="flex items-center space-x-2 text-red-600">
                        <XCircle className="h-5 w-5" />
                        <span className="text-sm">{validationErrors[file.name]}</span>
                      </div>
                    ) : fileStats[file.name]?.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : fileStats[file.name]?.status === 'error' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Mode */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-3">Export Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                exportMode === 'combined' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  value="combined"
                  checked={exportMode === 'combined'}
                  onChange={(e) => setExportMode(e.target.value)}
                  className="mr-2"
                />
                <span className="font-medium">Combined Excel</span>
                <p className="text-xs text-gray-600 mt-1">All documents in one file</p>
              </label>
              
              <label className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                exportMode === 'separate' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  value="separate"
                  checked={exportMode === 'separate'}
                  onChange={(e) => setExportMode(e.target.value)}
                  className="mr-2"
                />
                <span className="font-medium">Separate Files</span>
                <p className="text-xs text-gray-600 mt-1">One Excel per document</p>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-gray-600 hover:text-gray-800 flex items-center space-x-2"
              >
                <Eye className="h-4 w-4" />
                <span className="text-sm">{showLogs ? 'Hide' : 'Show'} Logs</span>
              </button>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Debug Mode</span>
              </label>
            </div>
            
            <button
              onClick={processFiles}
              disabled={files.length === 0 || processing}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Settings className="h-5 w-5" />
                  <span>Process Statements</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Processing Status */}
        {currentStep && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-blue-800">{currentStep}</span>
            </div>
          </div>
        )}

        {/* Logs */}
        {showLogs && logs.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Processing Logs</h3>
              <button
                onClick={() => setLogs([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded text-sm ${
                    log.type === 'error' ? 'bg-red-50 text-red-800' :
                    log.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                    log.type === 'success' ? 'bg-green-50 text-green-800' :
                    'bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="font-mono text-xs mr-2">{log.timestamp}</span>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Display */}
        {hasResults && (
          <>
            <EnhancedResultsDisplay
              results={results}
              uncategorizedData={uncategorizedData}
              fileStats={fileStats}
            />
            
            <SimpleGroupingControls
              onExportWithGrouping={handleExportWithGrouping}
              processing={processing}
              exportMode={exportMode}
              hasResults={hasResults}
              transactionCount={Object.values(results).reduce((sum, arr) => sum + arr.length, 0) + uncategorizedData.length}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default BankStatementProcessor;
