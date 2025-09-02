import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, Info, TrendingUp, DollarSign, ThumbsUp, AlertTriangle, Shield, X, RotateCcw, Files, File } from 'lucide-react';

const BankStatementProcessor = () => {
  // Core state management
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [consolidatedExport, setConsolidatedExport] = useState(false);
  const [fileProgress, setFileProgress] = useState({});
  const [processingStats, setProcessingStats] = useState({ completed: 0, total: 0, failed: 0 });
  const [fileValidationResults, setFileValidationResults] = useState({});
  const [flippedCards, setFlippedCards] = useState({});
  const fileInputRef = useRef(null);

  // Document counters state
  const [documentCounters, setDocumentCounters] = useState({
    totalUploaded: 0,
    totalValidated: 0,
    totalProcessed: 0,
    totalFailed: 0,
    currentBatch: 0,
    lifetimeProcessed: 0
  });

  // Mapping rules for transaction categorization
  const mappingRules = {
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
    'JUICE Account Transfer': 'SCHEME (PRIME)',
    'JuicePro Transfer': 'SCHEME (PRIME)',
    'Government Instant Payment': 'SCHEME (PRIME)',
    'MAUBANK': 'SCHEME (PRIME)',
    'SBM BANK': 'SCHEME (PRIME)',
    'MCB BANK': 'SCHEME (PRIME)',
    'Direct Debit Scheme': 'CSG',
    'MAURITIUS REVENUE AUTHORITY': 'CSG',
    'MRA': 'CSG',
    'CSG CONTRIBUTION': 'CSG',
    'NATIONAL PENSION FUND': 'CSG',
    'NPF': 'CSG',
    'INCOME TAX': 'CSG',
    'VAT': 'CSG',
    'ATM Cash Deposit': 'SALES',
    'Cash Deposit': 'SALES',
    'DEPOSIT': 'SALES',
    'CREDIT TRANSFER': 'SALES',
    'COLLECTION': 'SALES',
    'PAYMENT RECEIVED': 'SALES',
    'REMITTANCE': 'SALES',
    'Cash Cheque': 'Salary',
    'Staff': 'Salary',
    'STAFF': 'Salary',
    'Salary': 'Salary',
    'PAYROLL': 'Salary',
    'WAGES': 'Salary',
    'BONUS': 'Salary',
    'ALLOWANCE': 'Salary',
    'Interbank Transfer': 'PRGF',
    'TRANSFER TO': 'PRGF',
    'TRANSFER FROM': 'PRGF',
    'FUND TRANSFER': 'PRGF',
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
    'TAXI': 'Transport',
    'BUS': 'Transport',
    'FUEL': 'Transport',
    'PETROL': 'Transport',
    'DIESEL': 'Transport',
    'CAR': 'Transport',
    'VEHICLE': 'Transport'
  };

  // Utility functions
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const toggleCardFlip = (cardId) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const resetCounters = (keepLifetime = false) => {
    setDocumentCounters(prev => ({
      totalUploaded: 0,
      totalValidated: 0,
      totalProcessed: 0,
      totalFailed: 0,
      currentBatch: 0,
      lifetimeProcessed: keepLifetime ? prev.lifetimeProcessed : 0
    }));
  };

  const removeFile = (indexToRemove) => {
    const fileToRemove = files[indexToRemove];
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
    
    const updatedProgress = { ...fileProgress };
    delete updatedProgress[fileToRemove.name];
    setFileProgress(updatedProgress);
    
    const updatedValidation = { ...fileValidationResults };
    delete updatedValidation[fileToRemove.name];
    setFileValidationResults(updatedValidation);
    
    addLog(`Removed ${fileToRemove.name}`, 'info');
  };

  const updateFileProgress = (fileName, updates) => {
    setFileProgress(prev => ({
      ...prev,
      [fileName]: { ...prev[fileName], ...updates }
    }));
  };

  const getValidationSummary = () => {
    const total = files.length;
    const valid = files.filter(file => fileValidationResults[file.name]?.isValid).length;
    const invalid = total - valid;
    const pending = files.filter(file => !fileValidationResults[file.name] || fileValidationResults[file.name].type === 'pending').length;
    
    return { total, valid, invalid, pending };
  };

  const canProcess = () => {
    const validFiles = files.filter(file => fileValidationResults[file.name]?.isValid);
    return validFiles.length > 0;
  };
  // Document analysis and validation functions
  const analyzeDocumentContent = (text, fileName, totalPages) => {
    const textLength = text.length;
    const meaningfulLines = text.split('\n').filter(line => 
      line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
    ).length;

    const bankingKeywords = [
      'statement', 'account', 'balance', 'transaction', 'credit', 'debit',
      'deposit', 'withdrawal', 'transfer', 'payment', 'bank', 'mcb',
      'mauritius commercial bank', 'trans date', 'value date', 'opening balance'
    ];

    const bankingKeywordMatches = bankingKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    const dateMatches = (text.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length;
    const currencyMatches = text.toLowerCase().includes('mur') ? 1 : 0;
    const textDensity = textLength / totalPages;

    addLog(`Analysis: ${bankingKeywordMatches} banking terms, ${dateMatches} dates, ${currencyMatches} currency, ${textDensity.toFixed(0)} chars/page`, 'info');

    const strongBankingIndicators = bankingKeywordMatches >= 3 && dateMatches >= 3 && currencyMatches >= 1;
    
    if (strongBankingIndicators) {
      return {
        isValid: true,
        type: 'valid_statement',
        confidence: 'high',
        message: 'Valid bank statement detected - Ready for processing!',
        details: { bankingKeywords: bankingKeywordMatches, dates: dateMatches, currency: currencyMatches }
      };
    }

    if (bankingKeywordMatches < 2 && dateMatches < 3 && currencyMatches === 0) {
      return {
        isValid: false,
        type: 'wrong_document',
        message: 'This does not appear to be a bank statement',
        suggestion: 'Please upload a valid bank statement document with transaction data.'
      };
    }

    return {
      isValid: true,
      type: 'valid_statement', 
      confidence: 'medium',
      message: 'Bank statement detected - Ready for processing!'
    };
  };

  const extractTextFromPDF = async (file) => {
    try {
      addLog(`Reading PDF: ${file.name}...`, 'info');
      
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          };
        });
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      addLog(`PDF loaded: ${pdf.numPages} pages found`, 'success');
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
        
        addLog(`Page ${pageNum} processed - ${pageText.length} characters`, 'info');
      }

      const meaningfulLines = fullText.split('\n').filter(line => 
        line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
      ).length;

      addLog(`Meaningful text lines found: ${meaningfulLines}`, 'info');

      if (meaningfulLines < 20) {
        addLog('Low text content detected - applying text enhancement...', 'info');
        
        fullText = fullText
          .replace(/\s+/g, ' ')
          .replace(/[^\x20-\x7E\n\r]/g, '')
          .trim();
        
        addLog('Text enhancement completed', 'success');
      }
      
      addLog(`PDF text extraction complete - ${fullText.length} total characters`, 'success');
      return fullText;
      
    } catch (error) {
      addLog(`PDF extraction failed for ${file.name}: ${error.message}`, 'error');
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setFiles(uploadedFiles);
    setLogs([]);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    setFileProgress({});
    setFileValidationResults({});
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
    
    addLog(`${uploadedFiles.length} file(s) uploaded - starting validation...`, 'info');

    // File validation loop
    let validatedCount = 0;
    for (const file of uploadedFiles) {
      try {
        if (file.type === 'application/pdf') {
          addLog(`Validating PDF: ${file.name}`, 'info');
          
          if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            document.head.appendChild(script);
            
            await new Promise((resolve) => {
              script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
              };
            });
          }
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          let sampleText = '';
          const pagesToCheck = Math.min(2, pdf.numPages);
          
          for (let pageNum = 1; pageNum <= pagesToCheck; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            sampleText += pageText + '\n';
          }
          
          const validation = analyzeDocumentContent(sampleText, file.name, pdf.numPages);
          
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
          setFileValidationResults(prev => ({
            ...prev,
            [file.name]: { 
              isValid: true, 
              message: 'Text file ready for processing',
              type: 'text_file'
            }
          }));
          
          setFileProgress(prev => ({
            ...prev,
            [file.name]: { ...prev[file.name], status: 'validated', progress: 25 }
          }));
          
          addLog(`${file.name}: Text file validated successfully`, 'success');
          validatedCount++;
        }
      } catch (error) {
        addLog(`Validation error for ${file.name}: ${error.message}`, 'error');
        
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
          [file.name]: { ...prev[file.name], status: 'validation_failed', progress: 0 }
        }));
      }
    }
    
    setDocumentCounters(prev => ({
      ...prev,
      totalValidated: validatedCount
    }));
    
    addLog(`Validation complete: ${validatedCount}/${uploadedFiles.length} files validated successfully`, 'success');
  };
  // Transaction processing and metadata extraction functions
  const extractStatementMetadata = (text, fileName) => {
    const metadata = {
      fileName: fileName,
      statementPeriod: null,
      accountNumber: null,
      iban: null,
      currency: null,
      statementType: null,
      statementPages: null,
      extractedDate: new Date().toISOString()
    };

    // Extract statement period using multiple patterns
    const periodPatterns = [
      /(?:statement\s+date|period)[:\s]+from\s+(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i,
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
      /account\s+number[:\s]+(\d{10,})/i,
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

    // Extract currency information
    if (text.toLowerCase().includes('mur')) {
      metadata.currency = 'MUR';
    }

    addLog(`Metadata extracted for ${fileName}: ${metadata.statementPeriod || 'No period found'}, Account: ${metadata.accountNumber || 'Not found'}`, 'info');
    return metadata;
  };

  const extractOpeningBalance = (text) => {
    const patterns = [
      /(?:opening|beginning)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /balance\s+(?:brought\s+)?forward[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /(?:previous|last)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /b\/f[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const balance = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(balance)) {
          return balance;
        }
      }
    }
    return 0;
  };

  const extractClosingBalance = (text) => {
    const patterns = [
      /(?:closing|ending|final)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /balance\s+(?:carried\s+)?forward[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /(?:current|new)\s+balance[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i,
      /c\/f[:\s]+(?:MUR\s+)?([\d,]+\.?\d*)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const balance = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(balance)) {
          return balance;
        }
      }
    }
    return 0;
  };

  const extractTransactionsFromText = (text, fileName) => {
    const transactions = [];
    addLog(`Analyzing text from ${fileName}...`, 'info');
    
    const statementMetadata = extractStatementMetadata(text, fileName);
    const openingBalance = extractOpeningBalance(text);
    const closingBalance = extractClosingBalance(text);
    
    addLog(`Opening Balance: MUR ${openingBalance.toLocaleString()}`, 'success');
    addLog(`Closing Balance: MUR ${closingBalance.toLocaleString()}`, 'success');
    
    // MCB transaction patterns
    const mcbPattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([-]?[\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
    
    addLog(`Searching for MCB transaction patterns...`, 'info');
    
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
          statementPeriod: statementMetadata.statementPeriod,
          accountNumber: statementMetadata.accountNumber,
          currency: statementMetadata.currency || 'MUR',
          extractedOn: statementMetadata.extractedDate
        });
        
        transactionCount++;
        addLog(`Transaction ${transactionCount}: ${transDate} - ${cleanDescription.substring(0, 40)}... - MUR ${Math.abs(transactionAmount)}`, 'success');
      }
    }
    
    const validTransactions = transactions.filter(t => t.amount > 0 && t.transactionDate && t.description);
    validTransactions.openingBalance = openingBalance;
    validTransactions.closingBalance = closingBalance;
    validTransactions.statementMetadata = statementMetadata;
    
    addLog(`Final count: ${validTransactions.length} valid transactions extracted`, 'success');
    return validTransactions;
  };

  const categorizeTransaction = (description) => {
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
  };

  const processSingleFile = async (file) => {
    const fileName = file.name;
    
    try {
      const validation = fileValidationResults[fileName];
      if (!validation?.isValid) {
        throw new Error(`Document validation failed: ${validation?.message || 'Unknown validation error'}`);
      }

      updateFileProgress(fileName, { status: 'processing', progress: 30 });
      addLog(`Starting ${fileName}...`, 'info');

      let extractedText = '';
      
      if (file.type === 'application/pdf') {
        updateFileProgress(fileName, { status: 'extracting', progress: 50 });
        extractedText = await extractTextFromPDF(file);
      } else {
        updateFileProgress(fileName, { status: 'reading', progress: 50 });
        extractedText = await file.text();
        addLog(`Text file processed: ${fileName}`, 'success');
      }

      if (extractedText) {
        updateFileProgress(fileName, { status: 'analyzing', progress: 75 });
        const transactions = extractTransactionsFromText(extractedText, fileName);
        
        updateFileProgress(fileName, { 
          status: 'completed', 
          progress: 100,
          transactions: transactions.length
        });
        
        addLog(`${fileName}: ${transactions.length} transactions extracted`, 'success');
        
        return {
          fileName,
          transactions,
          balanceInfo: {
            openingBalance: transactions.openingBalance || 0,
            closingBalance: transactions.closingBalance || 0
          },
          success: true
        };
      } else {
        throw new Error('No text extracted from file');
      }
    } catch (error) {
      updateFileProgress(fileName, { 
        status: 'failed', 
        progress: 0,
        error: error.message
      });
      
      addLog(`${fileName}: ${error.message}`, 'error');
      
      return {
        fileName,
        transactions: [],
        balanceInfo: { openingBalance: 0, closingBalance: 0 },
        success: false,
        error: error.message
      };
    }
  };
  // Main processing function and Excel export
  const processFiles = async () => {
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
      const results = [];
      
      for (const file of validFiles) {
        const result = await processSingleFile(file);
        results.push(result);
        
        setProcessingStats(prev => ({
          ...prev,
          completed: prev.completed + 1,
          failed: result.success ? prev.failed : prev.failed + 1
        }));
      }

      const allTransactions = [];
      const stats = {};
      const balanceInfo = {};

      results.forEach(result => {
        if (result.success) {
          allTransactions.push(...result.transactions);
          const metadata = result.transactions.statementMetadata || {};
          
          balanceInfo[result.fileName] = result.balanceInfo;
          
          stats[result.fileName] = {
            total: result.transactions.length,
            categorized: 0,
            uncategorized: 0,
            openingBalance: result.balanceInfo.openingBalance,
            closingBalance: result.balanceInfo.closingBalance,
            status: 'success',
            statementPeriod: metadata.statementPeriod || 'Unknown period',
            accountNumber: metadata.accountNumber || 'Unknown account',
            currency: metadata.currency || 'MUR'
          };
        } else {
          stats[result.fileName] = {
            total: 0,
            categorized: 0,
            uncategorized: 0,
            openingBalance: 0,
            closingBalance: 0,
            status: 'failed',
            error: result.error
          };
        }
      });

      setFileStats({...stats, balanceInfo});

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
      
      const finalProcessedCount = results.filter(r => r.success).length;
      const finalFailedCount = results.filter(r => !r.success).length;
      
      setDocumentCounters(prev => ({
        ...prev,
        totalProcessed: finalProcessedCount,
        totalFailed: finalFailedCount,
        lifetimeProcessed: prev.lifetimeProcessed + finalProcessedCount
      }));

      const totalCategorized = Object.values(categorizedData).reduce((sum, arr) => sum + arr.length, 0);
      const totalProcessed = totalCategorized + uncategorized.length;
      const successRate = totalProcessed > 0 ? ((totalCategorized / totalProcessed) * 100).toFixed(1) : 0;

      addLog(`Processing complete: ${finalProcessedCount}/${validFiles.length} documents processed successfully`, 'success');
      addLog(`Total: ${totalProcessed}, Categorized: ${totalCategorized}, Uncategorized: ${uncategorized.length}`, 'success');
      addLog(`Success Rate: ${successRate}%`, 'success');

    } catch (error) {
      addLog(`Processing error: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const generateExcel = () => {
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
      const wb = XLSX.utils.book_new();
      const timestamp = new Date().toLocaleString();
      
      const summaryData = [
        ['ENHANCED BANK STATEMENT PROCESSING REPORT'],
        ['Generated:', timestamp],
        [''],
        ['PROCESSING SUMMARY'],
        ['Documents Uploaded:', documentCounters.totalUploaded],
        ['Documents Validated:', documentCounters.totalValidated],
        ['Documents Processed:', documentCounters.totalProcessed],
        ['Documents Failed:', documentCounters.totalFailed],
        ['Session Lifetime Total:', documentCounters.lifetimeProcessed],
        [''],
        ['SUMMARY BY CATEGORY'],
        ['Category', 'Count', 'Total Amount (MUR)', 'Avg Amount (MUR)'],
      ];
      
      Object.entries(results).forEach(([category, transactions]) => {
        if (transactions.length > 0) {
          const total = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
          const avg = total / transactions.length;
          summaryData.push([category, transactions.length, total.toFixed(2), avg.toFixed(2)]);
        }
      });
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
      
      const transactionData = [
        ['Date', 'Value Date', 'Description', 'Amount (MUR)', 'Balance', 'Category', 'Source File', 'Account Number', 'Currency']
      ];
      
      Object.entries(results).forEach(([category, transactions]) => {
        transactions.forEach(transaction => {
          transactionData.push([
            transaction.transactionDate,
            transaction.valueDate,
            transaction.description,
            transaction.amount.toFixed(2),
            transaction.balance.toFixed(2),
            category,
            transaction.sourceFile,
            transaction.accountNumber || 'N/A',
            transaction.currency || 'MUR'
          ]);
        });
      });
      
      uncategorizedData.forEach(transaction => {
        transactionData.push([
          transaction.transactionDate,
          transaction.valueDate,
          transaction.description,
          transaction.amount.toFixed(2),
          transaction.balance.toFixed(2),
          'UNCATEGORIZED',
          transaction.sourceFile,
          transaction.accountNumber || 'N/A',
          transaction.currency || 'MUR'
        ]);
      });
      
      const transactionWS = XLSX.utils.aoa_to_sheet(transactionData);
      XLSX.utils.book_append_sheet(wb, transactionWS, "All Transactions");
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Statement_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      addLog('Excel report downloaded successfully!', 'success');
    });
  };

  const getBalanceStats = () => {
    if (!results || !fileStats.balanceInfo) return { 
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
    
    const balanceInfo = fileStats.balanceInfo || {};
    const openingBalance = Object.values(balanceInfo).reduce((sum, info) => sum + (info.openingBalance || 0), 0);
    const closingBalance = Object.values(balanceInfo).reduce((sum, info) => sum + (info.closingBalance || 0), 0);
    
    return { 
      totalTransactions, 
      openingBalance, 
      closingBalance, 
      categories,
      categorizedCount,
      uncategorizedCount
    };
  };

  // FlippableCard component
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
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border flex items-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <Icon className={`h-8 w-8 ${iconColorClasses[color]} mr-3 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`text-2xl font-bold ${colorClasses[color]} truncate`}>{frontValue}</div>
              <div className="text-sm text-gray-600 truncate">{frontSubtitle}</div>
            </div>
            <RotateCcw className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
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

  // Main UI component
  const validationSummary = getValidationSummary();
  const stats = getBalanceStats();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Enhanced Bank Statement Processor</h1>
            <p className="text-blue-100">Complete document processing with transaction categorization and Excel export</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <Files className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Document Counters Dashboard */}
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
            { label: "Status", value: documentCounters.totalUploaded > 0 ? "Ready" : "Waiting", color: documentCounters.totalUploaded > 0 ? "text-green-600" : "text-gray-500" },
            { label: "Upload Rate", value: "100%", color: "text-blue-600" }
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
            { label: "Efficiency", value: documentCounters.lifetimeProcessed > 0 ? "Active Session" : "New Session", color: "text-green-600" }
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

      {/* File Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Document Upload & Validation</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {validationSummary.total > 0 && `${validationSummary.valid}/${validationSummary.total} validated`}
            </span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Upload Bank Statement Documents
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Support for PDF and text files with automatic validation
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Choose Files
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-800">Uploaded Files ({files.length})</h3>
              <div className="space-y-2">
                {files.map((file, index) => {
                  const progress = fileProgress[file.name] || { status: 'pending', progress: 0 };
                  const validation = fileValidationResults[file.name];
                  
                  return (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
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
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {validation && (
                        <div className="mb-2">
                          <div className={`text-xs px-2 py-1 rounded ${
                            validation.isValid 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {validation.message}
                          </div>
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
                            <div className="text-xs text-red-600 mt-1">
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
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={processFiles}
            disabled={!canProcess() || processing}
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
              setProcessingStats({ completed: 0, total: 0, failed: 0 });
              setFlippedCards({});
              resetCounters(true);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
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
              <span>Download Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Display */}
      {results && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Processing Results</h2>
            <div className="text-sm text-gray-600">
              {stats.categorizedCount + stats.uncategorizedCount} total transactions processed
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
              {logs.map((log, index) => (
                <div
                  key={index}
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
