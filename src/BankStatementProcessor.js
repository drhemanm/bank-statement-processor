import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, TrendingUp, RotateCcw, Files, X, AlertTriangle, Settings, FileOutput, FilePlus } from 'lucide-react';

const BankStatementProcessor = () => {
  // Core state management with better initial values
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [fileProgress, setFileProgress] = useState({});
  const [processingStats, setProcessingStats] = useState({ completed: 0, total: 0, failed: 0 });
  const [fileValidationResults, setFileValidationResults] = useState({});
  const [flippedCards, setFlippedCards] = useState({});
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // NEW ENHANCED FEATURES - Upload Mode & Export Mode
  const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'multiple'
  const [exportMode, setExportMode] = useState('separate'); // 'separate' or 'combined'
  const [statementMetadata, setStatementMetadata] = useState({});

  // Document counters state
  const [documentCounters, setDocumentCounters] = useState({
    totalUploaded: 0,
    totalValidated: 0,
    totalProcessed: 0,
    totalFailed: 0,
    currentBatch: 0,
    lifetimeProcessed: 0
  });

  // Enhanced mapping rules with comprehensive patterns
  const mappingRules = useMemo(() => ({
    'Business Banking Subs Fee': 'BANK CHARGES',
    'Standing order Charges': 'BANK CHARGES',
    'Account Maintenance Fee': 'BANK CHARGES',
    'Service Charge': 'BANK CHARGES',
    'SMS Banking Fee': 'BANK CHARGES',
    'Cheque Book Fee': 'BANK CHARGES',
    'ATM Fee': 'BANK CHARGES',
    'Overdraft Fee': 'BANK CHARGES',
    'Processing Fee': 'BANK CHARGES',
    'Commission': 'BANK CHARGES',
    'Monthly Fee': 'BANK CHARGES',
    'Annual Fee': 'BANK CHARGES',
    'JUICE Account Transfer': 'SCHEME (PRIME)',
    'JuicePro Transfer': 'SCHEME (PRIME)',
    'Government Instant Payment': 'SCHEME (PRIME)',
    'MAUBANK': 'SCHEME (PRIME)',
    'SBM BANK': 'SCHEME (PRIME)',
    'MCB BANK': 'SCHEME (PRIME)',
    'Instant Transfer': 'SCHEME (PRIME)',
    'Real Time Transfer': 'SCHEME (PRIME)',
    'Direct Debit Scheme': 'CSG',
    'MAURITIUS REVENUE AUTHORITY': 'CSG',
    'MRA': 'CSG',
    'CSG CONTRIBUTION': 'CSG',
    'NATIONAL PENSION FUND': 'CSG',
    'NPF': 'CSG',
    'INCOME TAX': 'CSG',
    'VAT': 'CSG',
    'Tax Payment': 'CSG',
    'ATM Cash Deposit': 'SALES',
    'Cash Deposit': 'SALES',
    'DEPOSIT': 'SALES',
    'CREDIT TRANSFER': 'SALES',
    'COLLECTION': 'SALES',
    'PAYMENT RECEIVED': 'SALES',
    'REMITTANCE': 'SALES',
    'Customer Payment': 'SALES',
    'Cash Cheque': 'Salary',
    'Staff': 'Salary',
    'STAFF': 'Salary',
    'Salary': 'Salary',
    'PAYROLL': 'Salary',
    'WAGES': 'Salary',
    'BONUS': 'Salary',
    'ALLOWANCE': 'Salary',
    'Employee Payment': 'Salary',
    'Interbank Transfer': 'PRGF',
    'TRANSFER TO': 'PRGF',
    'TRANSFER FROM': 'PRGF',
    'FUND TRANSFER': 'PRGF',
    'Internal Transfer': 'PRGF',
    'Merchant Instant Payment': 'MISCELLANEOUS',
    'Refill Amount': 'MISCELLANEOUS',
    'VAT on Refill': 'MISCELLANEOUS',
    'SHELL': 'MISCELLANEOUS',
    'TOTAL': 'MISCELLANEOUS',
    'ORANGE': 'MISCELLANEOUS',
    'EMTEL': 'MISCELLANEOUS',
    'MY.T': 'MISCELLANEOUS',
    'UTILITY': 'MISCELLANEOUS',
    'CEB': 'MISCELLANEOUS',
    'CWA': 'MISCELLANEOUS',
    'WASTE WATER': 'MISCELLANEOUS',
    'INTERNET': 'MISCELLANEOUS',
    'Mobile Payment': 'MISCELLANEOUS',
    'TAXI': 'Transport',
    'BUS': 'Transport',
    'FUEL': 'Transport',
    'PETROL': 'Transport',
    'DIESEL': 'Transport',
    'CAR': 'Transport',
    'VEHICLE': 'Transport',
    'Transportation': 'Transport'
  }), []);

  // Enhanced utility functions with error handling
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp, id: Date.now() }]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error, context = 'Unknown') => {
    const errorMessage = error?.message || 'An unexpected error occurred';
    addLog(`${context}: ${errorMessage}`, 'error');
    setError({ message: errorMessage, context });
  }, [addLog]);

  const toggleCardFlip = useCallback((cardId) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  }, []);

  const resetCounters = useCallback((keepLifetime = false) => {
    setDocumentCounters(prev => ({
      totalUploaded: 0,
      totalValidated: 0,
      totalProcessed: 0,
      totalFailed: 0,
      currentBatch: 0,
      lifetimeProcessed: keepLifetime ? prev.lifetimeProcessed : 0
    }));
  }, []);

  const removeFile = useCallback((indexToRemove) => {
    const fileToRemove = files[indexToRemove];
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
    
    const updatedProgress = { ...fileProgress };
    delete updatedProgress[fileToRemove.name];
    setFileProgress(updatedProgress);
    
    const updatedValidation = { ...fileValidationResults };
    delete updatedValidation[fileToRemove.name];
    setFileValidationResults(updatedValidation);
    
    // Remove metadata for this file
    const updatedMetadata = { ...statementMetadata };
    delete updatedMetadata[fileToRemove.name];
    setStatementMetadata(updatedMetadata);
    
    addLog(`Removed ${fileToRemove.name}`, 'info');
  }, [files, fileProgress, fileValidationResults, statementMetadata, addLog]);

  const updateFileProgress = useCallback((fileName, updates) => {
    setFileProgress(prev => ({
      ...prev,
      [fileName]: { ...prev[fileName], ...updates }
    }));
  }, []);

  // Enhanced validation functions
  const getValidationSummary = useMemo(() => {
    const total = files.length;
    const valid = files.filter(file => fileValidationResults[file.name]?.isValid).length;
    const invalid = total - valid;
    const pending = files.filter(file => !fileValidationResults[file.name] || fileValidationResults[file.name].type === 'pending').length;
    
    return { total, valid, invalid, pending };
  }, [files, fileValidationResults]);

  const canProcess = useMemo(() => {
    const validFiles = files.filter(file => fileValidationResults[file.name]?.isValid);
    return validFiles.length > 0 && !processing;
  }, [files, fileValidationResults, processing]);
  // ENHANCED METADATA EXTRACTION - Extracts opening/closing balance and statement period
  const extractStatementMetadata = useCallback((text, fileName) => {
    const metadata = {
      fileName: fileName,
      statementPeriod: null,
      accountNumber: null,
      iban: null,
      currency: null,
      openingBalance: 0,
      closingBalance: 0,
      statementType: null,
      extractedDate: new Date().toISOString()
    };

    // Extract statement period (Statement Date: From 03/01/2022 to 30/06/2022)
    const periodPatterns = [
      /statement\s+date[:\s]+from\s+(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i,
      /from\s+(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i,
      /period[:\s]+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i
    ];

    for (const pattern of periodPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.statementPeriod = `${match[1]} to ${match[2]}`;
        break;
      }
    }

    // Extract account number
    const accountPatterns = [
      /account\s+number[:\s]+(\d+)/i,
      /account[:\s]+(\d{10,})/i,
      /a\/c[:\s]+(\d{10,})/i
    ];

    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.accountNumber = match[1];
        break;
      }
    }

    // Extract IBAN
    const ibanMatch = text.match(/iban[:\s]+(MU\d{2}[A-Z0-9]+)/i);
    if (ibanMatch) {
      metadata.iban = ibanMatch[1];
    }

    // Extract currency
    const currencyMatch = text.match(/currency[:\s]+([A-Z]{3})/i);
    if (currencyMatch) {
      metadata.currency = currencyMatch[1];
    } else if (text.toLowerCase().includes('mur')) {
      metadata.currency = 'MUR';
    }

    // Extract opening balance
    const openingPatterns = [
      /(?:opening|beginning)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /balance\s+(?:brought\s+)?forward[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /(?:previous|last)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /b\/f[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i
    ];
    
    for (const pattern of openingPatterns) {
      const match = text.match(pattern);
      if (match) {
        const balance = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(balance)) {
          metadata.openingBalance = balance;
          break;
        }
      }
    }

    // Extract closing balance
    const closingPatterns = [
      /(?:closing|ending|final)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /balance\s+(?:carried\s+)?forward[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /(?:current|new)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /c\/f[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i
    ];
    
    for (const pattern of closingPatterns) {
      const match = text.match(pattern);
      if (match) {
        const balance = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(balance)) {
          metadata.closingBalance = balance;
          break;
        }
      }
    }

    addLog(`Metadata extracted for ${fileName}: ${metadata.statementPeriod || 'No period found'}, Account: ${metadata.accountNumber || 'Not found'}`, 'info');
    addLog(`Balances - Opening: MUR ${metadata.openingBalance.toLocaleString()}, Closing: MUR ${metadata.closingBalance.toLocaleString()}`, 'success');
    
    return metadata;
  }, [addLog]);

  // Enhanced document analysis
  const analyzeDocumentContent = useCallback((text, fileName, totalPages) => {
    try {
      const textLength = text.length;
      const meaningfulLines = text.split('\n').filter(line => 
        line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
      ).length;

      const bankingKeywords = [
        'statement', 'account', 'balance', 'transaction', 'credit', 'debit',
        'deposit', 'withdrawal', 'transfer', 'payment', 'bank', 'mcb',
        'mauritius commercial bank', 'trans date', 'value date', 'opening balance',
        'closing balance', 'carried forward', 'brought forward', 'iban', 'regular account'
      ];

      const bankingKeywordMatches = bankingKeywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      const dateMatches = (text.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length;
      const currencyMatches = (text.toLowerCase().match(/mur|mauritius rupee|rs/g) || []).length;
      const textDensity = totalPages > 0 ? textLength / totalPages : textLength;

      // Extract and store metadata during analysis
      const metadata = extractStatementMetadata(text, fileName);
      setStatementMetadata(prev => ({
        ...prev,
        [fileName]: metadata
      }));

      addLog(`Analysis: ${bankingKeywordMatches} banking terms, ${dateMatches} dates, ${currencyMatches} currency, ${textDensity.toFixed(0)} chars/page`, 'info');

      // Enhanced validation criteria
      const strongBankingIndicators = bankingKeywordMatches >= 3 && dateMatches >= 3 && currencyMatches >= 1;
      const moderateBankingIndicators = bankingKeywordMatches >= 2 && dateMatches >= 2;
      
      if (strongBankingIndicators) {
        return {
          isValid: true,
          type: 'valid_statement',
          confidence: 'high',
          message: 'Valid bank statement detected - Ready for processing!',
          details: { bankingKeywords: bankingKeywordMatches, dates: dateMatches, currency: currencyMatches, textDensity },
          metadata: metadata
        };
      }

      if (moderateBankingIndicators) {
        return {
          isValid: true,
          type: 'valid_statement', 
          confidence: 'medium',
          message: 'Bank statement detected - Ready for processing!',
          details: { bankingKeywords: bankingKeywordMatches, dates: dateMatches, currency: currencyMatches, textDensity },
          metadata: metadata
        };
      }

      if (bankingKeywordMatches < 2 && dateMatches < 2) {
        return {
          isValid: false,
          type: 'wrong_document',
          message: 'This does not appear to be a bank statement',
          suggestion: 'Please upload a valid bank statement document with transaction data.',
          details: { bankingKeywords: bankingKeywordMatches, dates: dateMatches, currency: currencyMatches }
        };
      }

      return {
        isValid: true,
        type: 'valid_statement', 
        confidence: 'low',
        message: 'Potential bank statement detected - Processing with caution',
        warning: 'Low confidence detection - results may vary',
        details: { bankingKeywords: bankingKeywordMatches, dates: dateMatches, currency: currencyMatches },
        metadata: metadata
      };
    } catch (error) {
      handleError(error, `Document analysis for ${fileName}`);
      return {
        isValid: false,
        type: 'analysis_error',
        message: 'Failed to analyze document',
        error: error.message
      };
    }
  }, [addLog, handleError, extractStatementMetadata]);

  // Enhanced PDF extraction with better error handling
  const extractTextFromPDF = useCallback(async (file) => {
    try {
      addLog(`Reading PDF: ${file.name}...`, 'info');
      
      // Load PDF.js if not already loaded
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('PDF.js loading timeout')), 10000);
          script.onload = () => {
            clearTimeout(timeout);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          };
          script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to load PDF.js'));
          };
        });
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      addLog(`PDF loaded: ${pdf.numPages} pages found`, 'success');
      
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 100); // Limit to prevent memory issues
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          
          fullText += pageText + '\n';
          
          if (pageNum % 10 === 0) {
            addLog(`Processed ${pageNum}/${maxPages} pages...`, 'info');
          }
        } catch (pageError) {
          addLog(`Warning: Failed to process page ${pageNum}: ${pageError.message}`, 'warning');
          continue;
        }
      }

      if (pdf.numPages > maxPages) {
        addLog(`Note: Limited processing to first ${maxPages} pages for performance`, 'warning');
      }

      const meaningfulLines = fullText.split('\n').filter(line => 
        line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
      ).length;

      addLog(`Meaningful text lines found: ${meaningfulLines}`, 'info');

      if (meaningfulLines < 10) {
        addLog('Low text content detected - document may require OCR enhancement', 'warning');
      }
      
      // Clean and normalize text
      fullText = fullText
        .replace(/\s+/g, ' ')
        .replace(/[^\x20-\x7E\n\r]/g, '')
        .trim();
      
      addLog(`PDF text extraction complete - ${fullText.length} total characters`, 'success');
      return fullText;
      
    } catch (error) {
      handleError(error, `PDF extraction for ${file.name}`);
      throw error;
    }
  }, [addLog, handleError]);

  // Enhanced transaction extraction
  const extractTransactionsFromText = useCallback((text, fileName) => {
    const transactions = [];
    addLog(`Analyzing transactions from ${fileName}...`, 'info');
    
    const metadata = statementMetadata[fileName] || {};
    
    // MCB transaction patterns
    const mcbPattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([-]?[\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
    
    let transactionCount = 0;
    let match;
    
    while ((match = mcbPattern.exec(text)) !== null) {
      const [fullMatch, transDate, valueDate, amount, balance, description] = match;
      
      const cleanDescription = description.trim().replace(/\s+/g, ' ').replace(/[\r\n]/g, '');
      const transactionAmount = parseFloat(amount.replace(/,/g, ''));
      const balanceAmount = parseFloat(balance.replace(/,/g, ''));
      
      if (cleanDescription.toLowerCase().includes('trans date') ||
          cleanDescription.toLowerCase().includes('statement page') ||
          cleanDescription.toLowerCase().includes('account number') ||
          cleanDescription.toLowerCase().includes('balance forward') ||
          isNaN(transactionAmount) || 
          cleanDescription.length < 3) {
        continue;
      }
      
      const isDuplicate = transactions.some(t => 
        t.transactionDate === transDate && 
        t.description === cleanDescription && 
        t.amount === Math.abs(transactionAmount)
      );
      
      if (!isDuplicate) {
        transactions.push({
          transactionDate: transDate,
          valueDate: valueDate,
          description: cleanDescription,
          amount: Math.abs(transactionAmount),
          balance: Math.abs(balanceAmount),
          sourceFile: fileName,
          originalLine: fullMatch.trim(),
          rawAmount: amount,
          isDebit: transactionAmount < 0 || amount.includes('-'),
          statementPeriod: metadata.statementPeriod,
          accountNumber: metadata.accountNumber,
          iban: metadata.iban,
          currency: metadata.currency || 'MUR',
          extractedOn: metadata.extractedDate,
          openingBalance: metadata.openingBalance,
          closingBalance: metadata.closingBalance
        });
        
        transactionCount++;
      }
    }
    
    addLog(`Extracted ${transactionCount} transactions from ${fileName}`, 'success');
    return transactions;
  }, [addLog, statementMetadata]);

  // Enhanced transaction categorization
  const categorizeTransaction = useCallback((description) => {
    const desc = description.toLowerCase();
    
    for (const [keyword, category] of Object.entries(mappingRules)) {
      if (desc.includes(keyword.toLowerCase())) {
        return { category, matched: true, keyword, confidence: 'high' };
      }
    }
    
    const fuzzyMatches = [];
    for (const [keyword, category] of Object.entries(mappingRules)) {
      const keywordLower = keyword.toLowerCase();
      const words = keywordLower.split(' ');
      const matchingWords = words.filter(word => desc.includes(word));
      
      if (matchingWords.length > 0) {
        const confidence = matchingWords.length / words.length;
        if (confidence >= 0.6) {
          fuzzyMatches.push({ category, keyword, confidence });
        }
      }
    }
    
    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      return { 
        category: bestMatch.category, 
        matched: true, 
        keyword: bestMatch.keyword,
        confidence: 'medium'
      };
    }
    
    return { category: 'UNCATEGORIZED', matched: false, keyword: null, confidence: 'none' };
  }, [mappingRules]);
  // Enhanced file upload with mode-specific logic
  const handleFileUpload = useCallback(async (event) => {
    try {
      clearError();
      const uploadedFiles = Array.from(event.target.files);
      
      if (uploadedFiles.length === 0) {
        return;
      }

      // Check upload mode restrictions
      if (uploadMode === 'single' && uploadedFiles.length > 1) {
        handleError(new Error(`Single document mode selected but ${uploadedFiles.length} files uploaded. Please select one file or switch to multiple document mode.`), 'File Upload');
        return;
      }

      // Validate file types and sizes
      const invalidFiles = uploadedFiles.filter(file => {
        const isValidType = file.type === 'application/pdf' || file.type === 'text/plain';
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit
        return !isValidType || !isValidSize;
      });

      if (invalidFiles.length > 0) {
        const errorMsg = `Invalid files detected: ${invalidFiles.map(f => f.name).join(', ')}. Please upload PDF or text files under 50MB.`;
        handleError(new Error(errorMsg), 'File Validation');
        return;
      }

      setFiles(uploadedFiles);
      setLogs([]);
      setResults(null);
      setUncategorizedData([]);
      setFileStats({});
      setFileProgress({});
      setFileValidationResults({});
      setStatementMetadata({});
      setProcessingStats({ completed: 0, total: 0, failed: 0 });
      setFlippedCards({});
      
      // Initialize document counters for this upload batch
      setDocumentCounters(prev => ({
        ...prev,
        totalUploaded: uploadedFiles.length,
        totalValidated: 0,
        totalProcessed: 0,
        totalFailed: 0,
        currentBatch: uploadedFiles.length
      }));
      
      const initialProgress = {};
      uploadedFiles.forEach(file => {
        initialProgress[file.name] = {
          status: 'validating',
          progress: 0,
          transactions: 0,
          error: null
        };
      });
      setFileProgress(initialProgress);
      
      addLog(`${uploadedFiles.length} file(s) uploaded in ${uploadMode} mode - starting validation...`, 'info');

      // File validation loop with better error handling
      let validatedCount = 0;
      for (const file of uploadedFiles) {
        try {
          addLog(`Validating: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
          
          if (file.type === 'application/pdf') {
            const sampleText = await extractTextFromPDF(file);
            
            if (!sampleText || sampleText.length < 50) {
              throw new Error('PDF appears to be empty or contains no extractable text');
            }
            
            const validation = analyzeDocumentContent(sampleText, file.name, 1);
            
            setFileValidationResults(prev => ({
              ...prev,
              [file.name]: validation
            }));

            if (validation.isValid) {
              addLog(`${file.name}: ${validation.message}`, 'success');
              setFileProgress(prev => ({
                ...prev,
                [file.name]: { ...prev[file.name], status: 'validated', progress: 25 }
              }));
              validatedCount++;
            } else {
              addLog(`${file.name}: ${validation.message}`, 'error');
              setFileProgress(prev => ({
                ...prev,
                [file.name]: { ...prev[file.name], status: 'validation_failed', progress: 0 }
              }));
            }
          } else {
            // Text file validation
            const textContent = await file.text();
            
            if (!textContent || textContent.length < 50) {
              throw new Error('Text file appears to be empty');
            }
            
            const validation = analyzeDocumentContent(textContent, file.name, 1);
            
            setFileValidationResults(prev => ({
              ...prev,
              [file.name]: validation
            }));
            
            setFileProgress(prev => ({
              ...prev,
              [file.name]: { ...prev[file.name], status: 'validated', progress: 25 }
            }));
            
            addLog(`${file.name}: Text file validated successfully`, 'success');
            validatedCount++;
          }
        } catch (error) {
          handleError(error, `Validation of ${file.name}`);
          
          setFileValidationResults(prev => ({
            ...prev,
            [file.name]: { 
              isValid: false, 
              message: 'Validation failed', 
              error: error.message,
              type: 'error'
            }
          }));
          
          setFileProgress(prev => ({
            ...prev,
            [file.name]: { ...prev[file.name], status: 'validation_failed', progress: 0, error: error.message }
          }));
        }
      }
      
      setDocumentCounters(prev => ({
        ...prev,
        totalValidated: validatedCount
      }));
      
      addLog(`Validation complete: ${validatedCount}/${uploadedFiles.length} files validated successfully`, validatedCount > 0 ? 'success' : 'warning');
      
    } catch (error) {
      handleError(error, 'File Upload');
    }
  }, [clearError, handleError, extractTextFromPDF, analyzeDocumentContent, addLog, uploadMode]);

  // Enhanced processing function
  const processFiles = useCallback(async () => {
    if (files.length === 0) {
      addLog('Please upload files first', 'error');
      return;
    }

    const validFiles = files.filter(file => fileValidationResults[file.name]?.isValid);
    
    if (validFiles.length === 0) {
      addLog('No valid files to process. Please upload valid bank statement documents.', 'error');
      return;
    }

    setProcessing(true);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    setProcessingStats({ completed: 0, total: validFiles.length, failed: 0 });
    
    addLog(`Starting processing of ${validFiles.length} validated files...`, 'info');

    try {
      const allTransactions = [];
      const stats = {};
      let processedCount = 0;
      let failedCount = 0;

      for (const file of validFiles) {
        try {
          updateFileProgress(file.name, { status: 'processing', progress: 50 });
          
          let extractedText = '';
          
          if (file.type === 'application/pdf') {
            extractedText = await extractTextFromPDF(file);
          } else {
            extractedText = await file.text();
          }

          if (extractedText) {
            updateFileProgress(file.name, { status: 'analyzing', progress: 75 });
            const transactions = extractTransactionsFromText(extractedText, file.name);
            
            allTransactions.push(...transactions);
            
            const metadata = statementMetadata[file.name] || {};
            
            stats[file.name] = {
              total: transactions.length,
              categorized: 0,
              uncategorized: 0,
              openingBalance: metadata.openingBalance || 0,
              closingBalance: metadata.closingBalance || 0,
              statementPeriod: metadata.statementPeriod || 'Unknown period',
              accountNumber: metadata.accountNumber || 'Unknown account',
              iban: metadata.iban || 'Unknown IBAN',
              currency: metadata.currency || 'MUR',
              status: 'success'
            };
            
            updateFileProgress(file.name, { 
              status: 'completed', 
              progress: 100,
              transactions: transactions.length
            });
            
            processedCount++;
            addLog(`${file.name}: ${transactions.length} transactions processed successfully`, 'success');
          } else {
            throw new Error('No text extracted from file');
          }
        } catch (error) {
          updateFileProgress(file.name, { 
            status: 'failed', 
            progress: 0,
            error: error.message
          });
          
          stats[file.name] = {
            total: 0,
            categorized: 0,
            uncategorized: 0,
            openingBalance: 0,
            closingBalance: 0,
            status: 'failed',
            error: error.message
          };
          
          failedCount++;
          addLog(`${file.name}: Processing failed - ${error.message}`, 'error');
        }
        
        setProcessingStats(prev => ({
          ...prev,
          completed: processedCount,
          failed: failedCount
        }));
      }

      setFileStats(stats);

      // Categorize transactions
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

      allTransactions.forEach(transaction => {
        const { category, matched, keyword, confidence } = categorizeTransaction(transaction.description);
        
        if (matched && category !== 'UNCATEGORIZED') {
          categorizedData[category].push({
            ...transaction,
            matchedKeyword: keyword,
            confidence: confidence
          });
          
          if (stats[transaction.sourceFile]) {
            stats[transaction.sourceFile].categorized++;
          }
        } else {
          uncategorized.push({
            ...transaction,
            reason: 'No matching rule found'
          });
          
          if (stats[transaction.sourceFile]) {
            stats[transaction.sourceFile].uncategorized++;
          }
        }
      });

      setResults(categorizedData);
      setUncategorizedData(uncategorized);
      
      setDocumentCounters(prev => ({
        ...prev,
        totalProcessed: processedCount,
        totalFailed: failedCount,
        lifetimeProcessed: prev.lifetimeProcessed + processedCount
      }));

      const totalCategorized = Object.values(categorizedData).reduce((sum, arr) => sum + arr.length, 0);
      const totalProcessed = totalCategorized + uncategorized.length;
      const successRate = totalProcessed > 0 ? ((totalCategorized / totalProcessed) * 100).toFixed(1) : 0;

      addLog(`Processing complete: ${processedCount}/${validFiles.length} documents processed successfully`, 'success');
      addLog(`Total: ${totalProcessed}, Categorized: ${totalCategorized}, Uncategorized: ${uncategorized.length}`, 'success');
      addLog(`Success Rate: ${successRate}%`, 'success');

    } catch (error) {
      addLog(`Processing error: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  }, [files, fileValidationResults, addLog, updateFileProgress, extractTextFromPDF, extractTransactionsFromText, statementMetadata, categorizeTransaction]);

  // ENHANCED EXCEL GENERATION - Supports both separate and combined export modes
  const generateExcel = useCallback(() => {
    if (!results) {
      addLog('No results to download', 'error');
      return;
    }

    const loadXLSX = () => {
      return new Promise((resolve) => {
        if (window.XLSX) {
          resolve(window.XLSX);
          return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => resolve(window.XLSX);
        document.head.appendChild(script);
      });
    };
    
    loadXLSX().then(XLSX => {
      const timestamp = new Date().toLocaleString();
      
      if (exportMode === 'separate') {
        // Generate separate Excel files for each document
        Object.keys(fileStats).forEach(fileName => {
          const fileData = fileStats[fileName];
          if (fileData.status === 'success') {
            const wb = XLSX.utils.book_new();
            
            // File-specific summary
            const summaryData = [
              [`BANK STATEMENT ANALYSIS REPORT - ${fileName}`],
              ['Generated:', timestamp],
              [''],
              ['DOCUMENT INFORMATION'],
              ['File Name:', fileName],
              ['Statement Period:', fileData.statementPeriod],
              ['Account Number:', fileData.accountNumber],
              ['IBAN:', fileData.iban || 'N/A'],
              ['Currency:', fileData.currency],
              ['Opening Balance:', `${fileData.currency} ${fileData.openingBalance.toLocaleString()}`],
              ['Closing Balance:', `${fileData.currency} ${fileData.closingBalance.toLocaleString()}`],
              [''],
              ['TRANSACTION SUMMARY'],
              ['Total Transactions:', fileData.total],
              ['Categorized:', fileData.categorized],
              ['Uncategorized:', fileData.uncategorized],
              ['']
            ];
            
            const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
            
            // Transactions for this file
            const fileTransactions = [
              ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Currency', 'Type']
            ];
            
            // Add categorized transactions
            Object.entries(results).forEach(([category, transactions]) => {
              transactions.filter(t => t.sourceFile === fileName).forEach(transaction => {
                fileTransactions.push([
                  transaction.transactionDate,
                  transaction.valueDate,
                  transaction.description,
                  transaction.amount.toFixed(2),
                  transaction.balance.toFixed(2),
                  category,
                  transaction.currency,
                  transaction.isDebit ? 'Debit' : 'Credit'
                ]);
              });
            });
            
            // Add uncategorized transactions
            uncategorizedData.filter(t => t.sourceFile === fileName).forEach(transaction => {
              fileTransactions.push([
                transaction.transactionDate,
                transaction.valueDate,
                transaction.description,
                transaction.amount.toFixed(2),
                transaction.balance.toFixed(2),
                'UNCATEGORIZED',
                transaction.currency,
                transaction.isDebit ? 'Debit' : 'Credit'
              ]);
            });
            
            const transactionWS = XLSX.utils.aoa_to_sheet(fileTransactions);
            XLSX.utils.book_append_sheet(wb, transactionWS, "Transactions");
            
            // Download file
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
            a.download = `${cleanFileName}_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        });
        
        addLog(`${Object.keys(fileStats).length} separate Excel files downloaded successfully!`, 'success');
        
      } else {
        // Generate combined Excel file
        const wb = XLSX.utils.book_new();
        
        // Combined summary with all file information
        const summaryData = [
          ['CONSOLIDATED BANK STATEMENT ANALYSIS REPORT'],
          ['Generated:', timestamp],
          ['Export Mode:', 'Combined'],
          [''],
          ['PROCESSING SUMMARY'],
          ['Documents Uploaded:', documentCounters.totalUploaded],
          ['Documents Validated:', documentCounters.totalValidated],
          ['Documents Processed:', documentCounters.totalProcessed],
          ['Documents Failed:', documentCounters.totalFailed],
          [''],
          ['DOCUMENT DETAILS']
        ];
        
        // Add each file's metadata
        Object.entries(fileStats).forEach(([fileName, fileData]) => {
          if (fileData.status === 'success') {
            summaryData.push([
              'File:', fileName,
              'Period:', fileData.statementPeriod,
              'Account:', fileData.accountNumber,
              'Opening:', `${fileData.currency} ${fileData.openingBalance.toLocaleString()}`,
              'Closing:', `${fileData.currency} ${fileData.closingBalance.toLocaleString()}`
            ]);
          }
        });
        
        summaryData.push(['']);
        summaryData.push(['SUMMARY BY CATEGORY']);
        summaryData.push(['Category', 'Count', 'Total Amount (MUR)', 'Avg Amount (MUR)']);
        
        Object.entries(results).forEach(([category, transactions]) => {
          if (transactions.length > 0) {
            const total = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
            const avg = total / transactions.length;
            summaryData.push([category, transactions.length, total.toFixed(2), avg.toFixed(2)]);
          }
        });
        
        const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
        
        // All transactions combined
        const allTransactionData = [
          ['Date', 'Value Date', 'Description', 'Amount (MUR)', 'Balance', 'Category', 'Source File', 'Account Number', 'Currency', 'Type']
        ];
        
        Object.entries(results).forEach(([category, transactions]) => {
          transactions.forEach(transaction => {
            allTransactionData.push([
              transaction.transactionDate,
              transaction.valueDate,
              transaction.description,
              transaction.amount.toFixed(2),
              transaction.balance.toFixed(2),
              category,
              transaction.sourceFile,
              transaction.accountNumber || 'N/A',
              transaction.currency || 'MUR',
              transaction.isDebit ? 'Debit' : 'Credit'
            ]);
          });
        });
        
        uncategorizedData.forEach(transaction => {
          allTransactionData.push([
            transaction.transactionDate,
            transaction.valueDate,
            transaction.description,
            transaction.amount.toFixed(2),
            transaction.balance.toFixed(2),
            'UNCATEGORIZED',
            transaction.sourceFile,
            transaction.accountNumber || 'N/A',
            transaction.currency || 'MUR',
            transaction.isDebit ? 'Debit' : 'Credit'
          ]);
        });
        
        const transactionWS = XLSX.utils.aoa_to_sheet(allTransactionData);
        XLSX.utils.book_append_sheet(wb, transactionWS, "All Transactions");
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Combined_Bank_Statement_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        addLog('Combined Excel report downloaded successfully!', 'success');
      }
    });
  }, [results, uncategorizedData, fileStats, exportMode, documentCounters, addLog]);
  // Flippable Card Component with improved styling
  const FlippableCard = ({ cardId, icon: Icon, frontTitle, frontValue, frontSubtitle, backContent, color = 'blue' }) => {
    const isFlipped = flippedCards[cardId];
    
    const colorClasses = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      yellow: 'text-yellow-600',
      red: 'text-red-600',
      purple: 'text-purple-600',
      indigo: 'text-indigo-600'
    };

    const iconColorClasses = {
      blue: 'text-blue-500',
      green: 'text-green-500',
      yellow: 'text-yellow-500',
      red: 'text-red-500',
      purple: 'text-purple-500',
      indigo: 'text-indigo-500'
    };
    
    return (
      <div 
        className="relative w-full h-40 cursor-pointer group"
        style={{ perspective: '1000px' }}
        onClick={() => toggleCardFlip(cardId)}
      >
        <div 
          className={`absolute inset-0 w-full h-full transition-transform duration-700 ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front of card */}
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border flex items-center hover:shadow-md transition-shadow"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <Icon className={`h-8 w-8 ${iconColorClasses[color]} mr-3 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`text-2xl font-bold ${colorClasses[color]} truncate`}>{frontValue}</div>
              <div className="text-sm text-gray-600 truncate">{frontSubtitle}</div>
            </div>
            <RotateCcw className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          {/* Back of card */}
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800 text-sm">{frontTitle} Details</h4>
                <RotateCcw className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 text-xs">
                  {backContent.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-gray-600">{item.label}</span>
                      <span className={`font-medium ${item.color || 'text-gray-800'}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Calculate stats for dashboard
  const getBalanceStats = useCallback(() => {
    if (!results) return { 
      totalTransactions: 0, 
      openingBalance: 0, 
      closingBalance: 0, 
      categories: 0, 
      categorizedCount: 0, 
      uncategorizedCount: 0
    };
    
    let categorizedCount = 0;
    let categories = 0;
    
    Object.entries(results).forEach(([category, transactions]) => {
      if (transactions.length > 0) {
        categorizedCount += transactions.length;
        categories++;
      }
    });
    
    const uncategorizedCount = uncategorizedData ? uncategorizedData.length : 0;
    const totalTransactions = categorizedCount + uncategorizedCount;
    
    // Calculate total balances from all processed files
    const openingBalance = Object.values(fileStats).reduce((sum, stats) => sum + (stats.openingBalance || 0), 0);
    const closingBalance = Object.values(fileStats).reduce((sum, stats) => sum + (stats.closingBalance || 0), 0);
    
    return { 
      totalTransactions, 
      openingBalance, 
      closingBalance, 
      categories,
      categorizedCount,
      uncategorizedCount
    };
  }, [results, uncategorizedData, fileStats]);

  const stats = getBalanceStats();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Enhanced Bank Statement Processor</h1>
            <p className="text-blue-100">Complete financial document processing with AI-powered categorization, balance extraction, and flexible export options</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <Files className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Panel - RADIO BUTTONS FOR UPLOAD/EXPORT MODES */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <Settings className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-800">Processing Configuration</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Mode Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Upload Mode</label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  id="single-mode"
                  name="upload-mode"
                  type="radio"
                  value="single"
                  checked={uploadMode === 'single'}
                  onChange={(e) => setUploadMode(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="single-mode" className="ml-3 flex items-center">
                  <FileText className="h-4 w-4 text-gray-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Single Document</div>
                    <div className="text-xs text-gray-500">Process one bank statement at a time</div>
                  </div>
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="multiple-mode"
                  name="upload-mode"
                  type="radio"
                  value="multiple"
                  checked={uploadMode === 'multiple'}
                  onChange={(e) => setUploadMode(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="multiple-mode" className="ml-3 flex items-center">
                  <FilePlus className="h-4 w-4 text-gray-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Multiple Documents</div>
                    <div className="text-xs text-gray-500">Process multiple bank statements together</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Export Mode Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Export Format</label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  id="separate-export"
                  name="export-mode"
                  type="radio"
                  value="separate"
                  checked={exportMode === 'separate'}
                  onChange={(e) => setExportMode(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="separate-export" className="ml-3 flex items-center">
                  <FileOutput className="h-4 w-4 text-gray-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Separate Excel Files</div>
                    <div className="text-xs text-gray-500">One Excel file per bank statement</div>
                  </div>
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="combined-export"
                  name="export-mode"
                  type="radio"
                  value="combined"
                  checked={exportMode === 'combined'}
                  onChange={(e) => setExportMode(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="combined-export" className="ml-3 flex items-center">
                  <Download className="h-4 w-4 text-gray-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Single Combined Excel</div>
                    <div className="text-xs text-gray-500">All statements in one Excel file</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Current Configuration:</strong> {uploadMode === 'single' ? 'Single document' : 'Multiple documents'} upload, 
            {exportMode === 'separate' ? ' separate Excel files' : ' combined Excel file'} export
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Error in {error.context}</h3>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Document Counters Dashboard - ENHANCED WITH NEW METADATA */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <FlippableCard
          cardId="uploaded"
          icon={Upload}
          frontTitle="Uploaded"
          frontValue={documentCounters.totalUploaded.toString()}
          frontSubtitle="Files uploaded"
          color="blue"
          backContent={[
            { label: "Current Batch", value: documentCounters.currentBatch.toString() },
            { label: "Mode", value: uploadMode === 'single' ? 'Single' : 'Multiple', color: "text-blue-600" },
            { label: "Status", value: documentCounters.totalUploaded > 0 ? "Ready" : "Waiting", color: documentCounters.totalUploaded > 0 ? "text-green-600" : "text-gray-500" }
          ]}
        />

        <FlippableCard
          cardId="validated"
          icon={CheckCircle}
          frontTitle="Validated"
          frontValue={documentCounters.totalValidated.toString()}
          frontSubtitle="Passed validation"
          color="green"
          backContent={[
            { label: "Validation Rate", value: documentCounters.totalUploaded > 0 ? `${((documentCounters.totalValidated / documentCounters.totalUploaded) * 100).toFixed(1)}%` : "0%", color: "text-green-600" },
            { label: "Failed Validation", value: (documentCounters.totalUploaded - documentCounters.totalValidated).toString(), color: "text-red-500" },
            { label: "Status", value: documentCounters.totalValidated > 0 ? "Ready to Process" : "Pending", color: documentCounters.totalValidated > 0 ? "text-green-600" : "text-yellow-600" }
          ]}
        />

        <FlippableCard
          cardId="processed"
          icon={Play}
          frontTitle="Processed"
          frontValue={documentCounters.totalProcessed.toString()}
          frontSubtitle="Successfully processed"
          color="purple"
          backContent={[
            { label: "Success Rate", value: documentCounters.totalValidated > 0 ? `${((documentCounters.totalProcessed / documentCounters.totalValidated) * 100).toFixed(1)}%` : "0%", color: "text-purple-600" },
            { label: "Remaining", value: Math.max(0, documentCounters.totalValidated - documentCounters.totalProcessed).toString(), color: "text-yellow-600" },
            { label: "Processing Status", value: processing ? "Running" : "Idle", color: processing ? "text-green-600" : "text-gray-500" }
          ]}
        />

        <FlippableCard
          cardId="failed"
          icon={AlertTriangle}
          frontTitle="Failed"
          frontValue={documentCounters.totalFailed.toString()}
          frontSubtitle="Processing failures"
          color="red"
          backContent={[
            { label: "Failure Rate", value: documentCounters.totalUploaded > 0 ? `${((documentCounters.totalFailed / documentCounters.totalUploaded) * 100).toFixed(1)}%` : "0%", color: "text-red-600" },
            { label: "Validation Fails", value: (documentCounters.totalUploaded - documentCounters.totalValidated).toString(), color: "text-orange-500" },
            { label: "Processing Fails", value: documentCounters.totalFailed.toString(), color: "text-red-600" }
          ]}
        />

        <FlippableCard
          cardId="lifetime"
          icon={TrendingUp}
          frontTitle="Session Total"
          frontValue={documentCounters.lifetimeProcessed.toString()}
          frontSubtitle="Total processed this session"
          color="yellow"
          backContent={[
            { label: "All Time High", value: documentCounters.lifetimeProcessed.toString(), color: "text-yellow-600" },
            { label: "Current Batch", value: documentCounters.totalProcessed.toString(), color: "text-purple-600" },
            { label: "Export Mode", value: exportMode === 'separate' ? 'Separate' : 'Combined', color: "text-indigo-600" }
          ]}
        />

        <FlippableCard
          cardId="transactions"
          icon={FileText}
          frontTitle="Transactions"
          frontValue={stats.totalTransactions.toString()}
          frontSubtitle="Total transactions found"
          color="indigo"
          backContent={[
            { label: "Categorized", value: stats.categorizedCount.toString(), color: "text-green-600" },
            { label: "Uncategorized", value: stats.uncategorizedCount.toString(), color: "text-red-600" },
            { label: "Categories", value: stats.categories.toString(), color: "text-indigo-600" }
          ]}
        />
      </div>

      {/* File Upload Section with Enhanced UI */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Document Upload & Validation</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {getValidationSummary.total > 0 && `${getValidationSummary.valid}/${getValidationSummary.total} validated`}
            </span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple={uploadMode === 'multiple'}
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Upload Bank Statement Documents
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Support for PDF and text files with automatic validation (Max 50MB per file)
              <br />
              <strong>{uploadMode === 'single' ? 'Single document mode' : 'Multiple documents mode'}</strong>
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadMode === 'single' ? 'Choose File' : 'Choose Files'}
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-800">Uploaded Files ({files.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {files.map((file, index) => {
                  const progress = fileProgress[file.name] || { status: 'pending', progress: 0 };
                  const validation = fileValidationResults[file.name];
                  const metadata = statementMetadata[file.name];
                  
                  return (
                    <div key={index} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
                              {metadata && metadata.statementPeriod && (
                                <span> • {metadata.statementPeriod}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {validation?.isValid === true && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {validation?.isValid === false && (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                          
                          <button
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            disabled={processing}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Enhanced validation display with balance info */}
                      {validation && (
                        <div className="mb-2">
                          <div className={`text-xs px-2 py-1 rounded ${
                            validation.isValid 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {validation.message}
                            {validation.confidence && ` (${validation.confidence} confidence)`}
                          </div>
                          
                          {/* Show balance information if available */}
                          {metadata && metadata.openingBalance !== undefined && (
                            <div className="text-xs text-blue-600 mt-1 px-2 py-1 bg-blue-50 rounded">
                              Opening: MUR {metadata.openingBalance.toLocaleString()} | 
                              Closing: MUR {metadata.closingBalance.toLocaleString()}
                              {metadata.accountNumber && ` | Account: ${metadata.accountNumber}`}
                            </div>
                          )}
                          
                          {validation.warning && (
                            <div className="text-xs text-yellow-600 mt-1 px-2 py-1 bg-yellow-50 rounded">
                              {validation.warning}
                            </div>
                          )}
                          {validation.suggestion && (
                            <div className="text-xs text-gray-600 mt-1">
                              {validation.suggestion}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {progress.status !== 'pending' && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">
                              Status: {progress.status.replace('_', ' ')}
                              {progress.transactions > 0 && ` (${progress.transactions} transactions)`}
                            </span>
                            <span className="text-gray-600">{progress.progress}%</span>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                progress.status === 'completed' ? 'bg-green-500' :
                                progress.status === 'failed' || progress.status === 'validation_failed' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                          
                          {progress.error && (
                            <div className="text-xs text-red-600 mt-1 p-2 bg-red-50 rounded">
                              {progress.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Processing Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Processing Controls</h2>
          <div className="flex items-center space-x-2">
            {processing && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing {processingStats.completed}/{processingStats.total}...</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4 flex-wrap gap-2">
          <button
            onClick={processFiles}
            disabled={!canProcess}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>Process Documents</span>
          </button>
          
          <button
            onClick={() => {
              setFiles([]);
              setResults(null);
              setLogs([]);
              setUncategorizedData([]);
              setFileStats({});
              setFileProgress({});
              setFileValidationResults({});
              setStatementMetadata({});
              setProcessingStats({ completed: 0, total: 0, failed: 0 });
              setFlippedCards({});
              clearError();
              resetCounters(true);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              addLog('Application reset successfully', 'info');
            }}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </button>
          
          {results && (
            <button
              onClick={generateExcel}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Excel ({exportMode === 'separate' ? 'Separate Files' : 'Combined File'})</span>
            </button>
          )}

          {!canProcess && files.length > 0 && (
            <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
              {processing ? 'Processing in progress...' : 'No valid files to process'}
            </div>
          )}
        </div>

        {(processingStats.total > 0 || processing) && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-600">{processingStats.completed}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-600">{processingStats.total - processingStats.completed - processingStats.failed}</div>
                <div className="text-xs text-gray-600">Remaining</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600">{processingStats.failed}</div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Results Display */}
      {results && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Processing Results</h2>
            <div className="text-sm text-gray-600">
              {stats.categorizedCount + stats.uncategorizedCount} total transactions processed
            </div>
          </div>
          
          {/* Balance Summary */}
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
                <div className="text-xl font-bold text-purple-600">{stats.totalTransactions}</div>
                <div className="text-xs text-gray-600">Total Transactions</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">{Object.keys(fileStats).length}</div>
                <div className="text-xs text-gray-600">Documents Processed</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(results).map(([category, transactions]) => {
              if (transactions.length === 0) return null;
              
              const categoryTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
              
              return (
                <div key={category} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800">{category}</h3>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {transactions.length}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    Total: MUR {categoryTotal.toLocaleString()}
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {transactions.slice(0, 5).map((transaction, index) => (
                      <div key={index} className="text-xs border-l-2 border-blue-200 pl-2">
                        <div className="font-medium">{transaction.description.substring(0, 40)}...</div>
                        <div className="text-gray-500">
                          {transaction.transactionDate} • MUR {transaction.amount.toLocaleString()}
                          {transaction.sourceFile && ` • ${transaction.sourceFile.substring(0, 15)}...`}
                        </div>
                      </div>
                    ))}
                    {transactions.length > 5 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        +{transactions.length - 5} more transactions
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {uncategorizedData.length > 0 && (
              <div className="border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-red-800">UNCATEGORIZED</h3>
                  <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                    {uncategorizedData.length}
                  </span>
                </div>
                
                <div className="text-sm text-red-600 mb-3">
                  Requires manual review
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {uncategorizedData.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="text-xs border-l-2 border-red-200 pl-2">
                      <div className="font-medium">{transaction.description.substring(0, 40)}...</div>
                      <div className="text-gray-500">
                        {transaction.transactionDate} • MUR {transaction.amount.toLocaleString()}
                        {transaction.sourceFile && ` • ${transaction.sourceFile.substring(0, 15)}...`}
                      </div>
                    </div>
                  ))}
                  {uncategorizedData.length > 5 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{uncategorizedData.length - 5} more transactions
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing Logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Processing Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="space-y-1 font-mono text-xs">
              {logs.slice(-100).map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start space-x-3 ${
                    log.type === 'error' ? 'text-red-600' :
                    log.type === 'success' ? 'text-green-600' :
                    log.type === 'warning' ? 'text-yellow-600' :
                    'text-gray-700'
                  }`}
                >
                  <span className="text-gray-400 flex-shrink-0">{log.timestamp}</span>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankStatementProcessor;
