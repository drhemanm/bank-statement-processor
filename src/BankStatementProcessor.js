import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, Info, TrendingUp, DollarSign, ThumbsUp, AlertTriangle, Shield, X, RotateCcw } from 'lucide-react';

const BankStatementProcessor = () => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [combinePDFs, setCombinePDFs] = useState(false);
  const [fileProgress, setFileProgress] = useState({});
  const [processingStats, setProcessingStats] = useState({ completed: 0, total: 0, failed: 0 });
  const [fileValidationResults, setFileValidationResults] = useState({});
  const [flippedCards, setFlippedCards] = useState({}); // New state for card flips
  const fileInputRef = useRef(null);

  // Flip card handler
  const toggleCardFlip = (cardId) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

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
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

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
    setFlippedCards({}); // Reset flipped cards on new upload
    
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
  const extractTransactionsFromText = (text, fileName) => {
    const transactions = [];
    
    addLog(`Analyzing text from ${fileName}...`, 'info');
    
    const openingBalance = extractOpeningBalance(text);
    const closingBalance = extractClosingBalance(text);
    
    addLog(`Opening Balance: MUR ${openingBalance.toLocaleString()}`, 'success');
    addLog(`Closing Balance: MUR ${closingBalance.toLocaleString()}`, 'success');
    
    const mcbPattern1 = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
    const mcbPattern2 = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
    
    addLog(`Searching for MCB transaction patterns...`, 'info');
    
    let transactionCount = 0;
    const patterns = [mcbPattern1, mcbPattern2];
    
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      let match;
      
      addLog(`Trying pattern ${patternIndex + 1}...`, 'info');
      
      while ((match = pattern.exec(text)) !== null) {
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
          addLog(`Skipping header/invalid: "${cleanDescription.substring(0, 50)}..."`, 'info');
          continue;
        }
        
        const isDuplicate = transactions.some(t => 
          t.transactionDate === transDate && 
          t.description === cleanDescription && 
          t.amount === Math.abs(transactionAmount)
        );
        
        if (isDuplicate) {
          addLog(`Skipping duplicate: ${transDate} - ${cleanDescription.substring(0, 30)}...`, 'info');
          continue;
        }
        
        transactions.push({
          transactionDate: transDate,
          valueDate: valueDate,
          description: cleanDescription,
          amount: Math.abs(transactionAmount),
          balance: Math.abs(balanceAmount),
          sourceFile: fileName,
          originalLine: fullMatch.trim(),
          rawAmount: amount,
          isDebit: transactionAmount < 0 || amount.includes('-')
        });
        
        transactionCount++;
        addLog(`Transaction ${transactionCount}: ${transDate} - ${cleanDescription.substring(0, 40)}... - MUR ${Math.abs(transactionAmount)} ${transactionAmount < 0 ? '(Debit)' : '(Credit)'}`, 'success');
      }
      
      if (transactionCount > 0) {
        addLog(`Pattern ${patternIndex + 1} successful - ${transactionCount} transactions found`, 'success');
        break;
      }
    }
    
    if (transactionCount === 0) {
      addLog(`No regex patterns worked, trying line-by-line parsing...`, 'info');
      
      const lines = text.split(/\r?\n/);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length < 20) continue;
        
        const lineMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([-]?[\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(.+)$/);
        
        if (lineMatch) {
          const [, transDate, valueDate, amount, balance, description] = lineMatch;
          const transactionAmount = parseFloat(amount.replace(/,/g, ''));
          const balanceAmount = parseFloat(balance.replace(/,/g, ''));
          
          if (!isNaN(transactionAmount) && description.trim().length > 3) {
            const cleanDescription = description.trim();
            
            const isDuplicate = transactions.some(t => 
              t.transactionDate === transDate && 
              t.description === cleanDescription && 
              Math.abs(t.amount - Math.abs(transactionAmount)) < 0.01
            );
            
            if (!isDuplicate) {
              transactions.push({
                transactionDate: transDate,
                valueDate: valueDate,
                description: cleanDescription,
                amount: Math.abs(transactionAmount),
                balance: Math.abs(balanceAmount),
                sourceFile: fileName,
                originalLine: line,
                rawAmount: amount,
                isDebit: transactionAmount < 0 || amount.includes('-')
              });
              
              transactionCount++;
              addLog(`Line Transaction ${transactionCount}: ${transDate} - ${cleanDescription.substring(0, 40)}... - MUR ${Math.abs(transactionAmount)}`, 'success');
            }
          }
        }
      }
    }
    
    const validTransactions = transactions.filter(t => t.amount > 0 && t.transactionDate && t.description);
    
    validTransactions.openingBalance = openingBalance;
    validTransactions.closingBalance = closingBalance;
    
    addLog(`Final count: ${validTransactions.length} valid transactions extracted`, 'success');
    
    return validTransactions;
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
    
    const firstTransactionMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([-]?[\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
    if (firstTransactionMatch) {
      const amount = parseFloat(firstTransactionMatch[3].replace(/,/g, ''));
      const balance = parseFloat(firstTransactionMatch[4].replace(/,/g, ''));
      if (!isNaN(amount) && !isNaN(balance)) {
        return Math.abs(balance - amount);
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
    
    const allTransactions = [...text.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([-]?[\d,]+\.?\d*)\s+([\d,]+\.?\d*)/g)];
    if (allTransactions.length > 0) {
      const lastTransaction = allTransactions[allTransactions.length - 1];
      const balance = parseFloat(lastTransaction[4].replace(/,/g, ''));
      if (!isNaN(balance)) {
        return Math.abs(balance);
      }
    }
    
    return 0;
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
  const processFiles = async () => {
    if (files.length === 0) {
      addLog('Please upload files first', 'error');
      return;
    }

    const validFiles = files.filter(file => fileValidationResults[file.name]?.isValid);
    const invalidFiles = files.filter(file => !fileValidationResults[file.name]?.isValid);

    if (validFiles.length === 0) {
      addLog('No valid files to process. Please upload valid bank statement documents.', 'error');
      return;
    }

    if (invalidFiles.length > 0) {
      addLog(`Warning: ${invalidFiles.length} file(s) will be skipped due to validation failures`, 'error');
    }

    setProcessing(true);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    setProcessingStats({ completed: 0, total: validFiles.length, failed: 0 });
    
    addLog(`Starting parallel processing of ${validFiles.length} validated files...`, 'info');

    try {
      const concurrencyLimit = 3;
      const results = [];
      
      for (let i = 0; i < validFiles.length; i += concurrencyLimit) {
        const batch = validFiles.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(file => processSingleFile(file));
        
        addLog(`Processing batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(validFiles.length/concurrencyLimit)}...`, 'info');
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        setProcessingStats(prev => ({
          ...prev,
          completed: results.length,
          failed: results.filter(r => !r.success).length
        }));
      }

      const allTransactions = [];
      const stats = {};
      const balanceInfo = {};
      let totalFailed = 0;

      results.forEach(result => {
        if (result.success) {
          allTransactions.push(...result.transactions);
          
          balanceInfo[result.fileName] = result.balanceInfo;
          
          stats[result.fileName] = {
            total: result.transactions.length,
            categorized: 0,
            uncategorized: 0,
            openingBalance: result.balanceInfo.openingBalance,
            closingBalance: result.balanceInfo.closingBalance,
            status: 'success'
          };
        } else {
          totalFailed++;
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
      
      const totalCategorized = Object.values(categorizedData).reduce((sum, arr) => sum + arr.length, 0);
      const totalProcessed = totalCategorized + uncategorized.length;
      const successRate = totalProcessed > 0 ? ((totalCategorized / totalProcessed) * 100).toFixed(1) : 0;
      
      const overallOpeningBalance = Object.values(balanceInfo).reduce((sum, info) => sum + info.openingBalance, 0);
      const overallClosingBalance = Object.values(balanceInfo).reduce((sum, info) => sum + info.closingBalance, 0);
      
      addLog(`Parallel processing complete!`, 'success');
      addLog(`Files: ${validFiles.length - totalFailed}/${validFiles.length} successful`, totalFailed > 0 ? 'error' : 'success');
      addLog(`Total: ${totalProcessed}, Categorized: ${totalCategorized}, Uncategorized: ${uncategorized.length}`, 'success');
      addLog(`Success Rate: ${successRate}%`, 'success');
      addLog(`Overall Opening Balance: MUR ${overallOpeningBalance.toLocaleString()}`, 'success');
      addLog(`Overall Closing Balance: MUR ${overallClosingBalance.toLocaleString()}`, 'success');

    } catch (error) {
      addLog(`Processing error: ${error.message}`, 'error');
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
        ['ENHANCED BANK STATEMENT PROCESSING REPORT - WITH FIXED VALIDATION'],
        ['Generated:', timestamp],
        ['Files Processed:', Object.keys(fileStats).filter(k => k !== 'balanceInfo').length],
        [''],
        ['SUMMARY BY CATEGORY'],
        ['Category', 'Count', 'Total Amount (MUR)', 'Avg Amount (MUR)', 'Percentage'],
      ];
      
      const totalAmount = Object.values(results).flat().reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalCount = Object.values(results).flat().length;
      
      Object.entries(results).forEach(([category, transactions]) => {
        if (transactions.length > 0) {
          const total = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
          const avg = total / transactions.length;
          const percentage = totalAmount > 0 ? ((total / totalAmount) * 100).toFixed(1) + '%' : '0%';
          summaryData.push([category, transactions.length, total.toFixed(2), avg.toFixed(2), percentage]);
        }
      });
      
      summaryData.push(['']);
      summaryData.push(['OVERALL STATISTICS']);
      summaryData.push(['Total Transactions:', totalCount + uncategorizedData.length]);
      summaryData.push(['Categorized:', totalCount]);
      summaryData.push(['Uncategorized:', uncategorizedData.length]);
      summaryData.push(['Success Rate:', `${totalCount > 0 ? ((totalCount / (totalCount + uncategorizedData.length)) * 100).toFixed(1) : 0}%`]);
      summaryData.push(['Total Amount:', `MUR ${totalAmount.toLocaleString()}`]);
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
      
      const transactionData = [
        ['Date', 'Value Date', 'Description', 'Amount (MUR)', 'Balance', 'Category', 'Source File', 'Status', 'Confidence']
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
            'Categorized',
            transaction.confidence || 'high'
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
          'Needs Review',
          'none'
        ]);
      });
      
      const transactionWS = XLSX.utils.aoa_to_sheet(transactionData);
      transactionWS['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 15 }, 
        { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 10 }
      ];
      
      XLSX.utils.book_append_sheet(wb, transactionWS, "All Transactions");
      
      if (uncategorizedData.length > 0) {
        const uncategorizedSheetData = [
          ['Date', 'Description', 'Amount (MUR)', 'Source File', 'Suggested Category', 'Manual Category']
        ];
        
        uncategorizedData.forEach(transaction => {
          uncategorizedSheetData.push([
            transaction.transactionDate,
            transaction.description,
            transaction.amount,
            transaction.sourceFile,
            '',
            ''
          ]);
        });
        
        const uncategorizedWS = XLSX.utils.aoa_to_sheet(uncategorizedSheetData);
        uncategorizedWS['!cols'] = [
          { wch: 12 }, { wch: 50 }, { wch: 15 }, 
          { wch: 25 }, { wch: 20 }, { wch: 20 }
        ];
        
        XLSX.utils.book_append_sheet(wb, uncategorizedWS, "Uncategorized");
      }
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Enhanced_Flippable_Cards_Bank_Statement_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      addLog('Enhanced Excel report with flippable cards downloaded!', 'success');
    });
  };

  const getBalanceStats = () => {
    if (!results || !fileStats.balanceInfo) return { 
      totalTransactions: 0, 
      openingBalance: 0, 
      closingBalance: 0, 
      categories: 0, 
      categorizedCount: 0, 
      uncategorizedCount: 0,
      creditCount: 0,
      debitCount: 0,
      largestTransaction: 0,
      smallestTransaction: 0,
      avgTransaction: 0
    };
    
    let categorizedCount = 0;
    let categories = 0;
    let creditCount = 0;
    let debitCount = 0;
    let allAmounts = [];
    
    Object.entries(results).forEach(([category, transactions]) => {
      if (transactions.length > 0) {
        categorizedCount += transactions.length;
        categories++;
        
        transactions.forEach(t => {
          allAmounts.push(t.amount);
          if (t.isDebit) {
            debitCount++;
          } else {
            creditCount++;
          }
        });
      }
    });
    
    const uncategorizedCount = uncategorizedData ? uncategorizedData.length : 0;
    const totalTransactions = categorizedCount + uncategorizedCount;
    
    const balanceInfo = fileStats.balanceInfo || {};
    const openingBalance = Object.values(balanceInfo).reduce((sum, info) => sum + (info.openingBalance || 0), 0);
    const closingBalance = Object.values(balanceInfo).reduce((sum, info) => sum + (info.closingBalance || 0), 0);
    
    const largestTransaction = allAmounts.length > 0 ? Math.max(...allAmounts) : 0;
    const smallestTransaction = allAmounts.length > 0 ? Math.min(...allAmounts) : 0;
    const avgTransaction = allAmounts.length > 0 ? allAmounts.reduce((sum, amt) => sum + amt, 0) / allAmounts.length : 0;
    
    return { 
      totalTransactions, 
      openingBalance, 
      closingBalance, 
      categories,
      categorizedCount,
      uncategorizedCount,
      creditCount,
      debitCount,
      largestTransaction,
      smallestTransaction,
      avgTransaction
    };
  };

  const canProcess = () => {
    const validFiles = files.filter(file => fileValidationResults[file.name]?.isValid);
    return validFiles.length > 0;
  };

  const getValidationSummary = () => {
    const total = files.length;
    const valid = files.filter(file => fileValidationResults[file.name]?.isValid).length;
    const invalid = total - valid;
    const pending = files.filter(file => !fileValidationResults[file.name] || fileValidationResults[file.name].type === 'pending').length;
    
    return { total, valid, invalid, pending };
  };

  // Enhanced Flippable Card Component
  const FlippableCard = ({ cardId, icon: Icon, frontTitle, frontValue, frontSubtitle, backContent, color = 'blue' }) => {
    const isFlipped = flippedCards[cardId];
    
    const colorClasses = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      yellow: 'text-yellow-600',
      red: 'text-red-600'
    };

    const iconColorClasses = {
      blue: 'text-blue-500',
      green: 'text-green-500',
      yellow: 'text-yellow-500',
      red: 'text-red-500'
    };
    
    return (
      <div 
        className="relative w-full h-32 cursor-pointer group"
        style={{ perspective: '1000px' }}
        onClick={() => toggleCardFlip(cardId)}
      >
        <div 
          className={`absolute inset-0 w-full h-full transition-transform duration-700 transform-style-preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front Face */}
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border flex items-center backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <Icon className={`h-8 w-8 ${iconColorClasses[color]} mr-3 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`text-2xl font-bold ${colorClasses[color]} truncate`}>{frontValue}</div>
              <div className="text-sm text-gray-600 truncate">{frontSubtitle}</div>
            </div>
            <RotateCcw className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          {/* Back Face */}
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border backface-hidden"
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

  const { 
    totalTransactions, 
    openingBalance, 
    closingBalance, 
    categories, 
    categorizedCount, 
    uncategorizedCount,
    creditCount,
    debitCount,
    largestTransaction,
    smallestTransaction,
    avgTransaction
  } = getBalanceStats();
  
  const successRate = totalTransactions > 0 ? ((categorizedCount / totalTransactions) * 100).toFixed(1) : 0;
  const validationSummary = getValidationSummary();
  const netChange = closingBalance - openingBalance;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Add CSS for 3D flip effects */}
      <style>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
      `}</style>
      
      <div className="max-w-7xl mx-auto p-6">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Enhanced Bank Statement Processor
          </h1>
          <p className="text-gray-600 text-lg">
            Advanced PDF processing with FLIPPABLE CARDS - Click any card to see detailed information
          </p>
        </div>

        {results && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <FlippableCard
              cardId="total-transactions"
              icon={FileText}
              frontTitle="Total Transactions"
              frontValue={totalTransactions}
              frontSubtitle="Total Transactions"
              color="blue"
              backContent={[
                { label: 'Credits', value: creditCount, color: 'text-green-600' },
                { label: 'Debits', value: debitCount, color: 'text-red-600' },
                { label: 'Largest', value: `MUR ${largestTransaction.toLocaleString()}`, color: 'text-blue-600' },
                { label: 'Smallest', value: `MUR ${smallestTransaction.toLocaleString()}`, color: 'text-gray-600' },
                { label: 'Average', value: `MUR ${avgTransaction.toLocaleString()}`, color: 'text-purple-600' }
              ]}
            />
            
            <FlippableCard
              cardId="categorized"
              icon={CheckCircle}
              frontTitle="Categorized"
              frontValue={categorizedCount}
              frontSubtitle={`Categorized (${successRate}%)`}
              color="green"
              backContent={[
                { label: 'Success Rate', value: `${successRate}%`, color: 'text-green-600' },
                { label: 'Categories Used', value: categories, color: 'text-blue-600' },
                { label: 'Auto-matched', value: categorizedCount, color: 'text-green-600' },
                { label: 'Need Review', value: uncategorizedCount, color: uncategorizedCount > 0 ? 'text-yellow-600' : 'text-green-600' },
                { label: 'Processing', value: 'Complete', color: 'text-green-600' }
              ]}
            />
            
            <FlippableCard
              cardId="opening-balance"
              icon={TrendingUp}
              frontTitle="Opening Balance"
              frontValue={`MUR ${openingBalance.toLocaleString()}`}
              frontSubtitle="Opening Balance"
              color="blue"
              backContent={[
                { label: 'Start Amount', value: `MUR ${openingBalance.toLocaleString()}`, color: 'text-blue-600' },
                { label: 'End Amount', value: `MUR ${closingBalance.toLocaleString()}`, color: 'text-green-600' },
                { label: 'Net Change', value: `MUR ${netChange.toLocaleString()}`, color: netChange >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Change %', value: `${openingBalance > 0 ? ((netChange / openingBalance) * 100).toFixed(1) : 0}%`, color: netChange >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Status', value: netChange >= 0 ? 'Positive' : 'Negative', color: netChange >= 0 ? 'text-green-600' : 'text-red-600' }
              ]}
            />
            
            <FlippableCard
              cardId="closing-balance"
              icon={DollarSign}
              frontTitle="Closing Balance"
              frontValue={`MUR ${closingBalance.toLocaleString()}`}
              frontSubtitle="Closing Balance"
              color="green"
              backContent={[
                { label: 'Final Amount', value: `MUR ${closingBalance.toLocaleString()}`, color: 'text-green-600' },
                { label: 'From Opening', value: `MUR ${openingBalance.toLocaleString()}`, color: 'text-blue-600' },
                { label: 'Total Credits', value: `${creditCount} transactions`, color: 'text-green-600' },
                { label: 'Total Debits', value: `${debitCount} transactions`, color: 'text-red-600' },
                { label: 'Net Activity', value: `${totalTransactions} transactions`, color: 'text-blue-600' }
              ]}
            />
            
            <FlippableCard
              cardId="need-review"
              icon={AlertCircle}
              frontTitle="Need Review"
              frontValue={uncategorizedCount}
              frontSubtitle="Need Review"
              color={uncategorizedCount > 0 ? 'yellow' : 'green'}
              backContent={[
                { label: 'Uncategorized', value: uncategorizedCount, color: uncategorizedCount > 0 ? 'text-yellow-600' : 'text-green-600' },
                { label: 'Auto-matched', value: categorizedCount, color: 'text-green-600' },
                { label: 'Success Rate', value: `${successRate}%`, color: parseFloat(successRate) >= 90 ? 'text-green-600' : parseFloat(successRate) >= 75 ? 'text-yellow-600' : 'text-red-600' },
                { label: 'Manual Review', value: uncategorizedCount > 0 ? 'Required' : 'None needed', color: uncategorizedCount > 0 ? 'text-yellow-600' : 'text-green-600' },
                { label: 'Priority', value: uncategorizedCount > 10 ? 'High' : uncategorizedCount > 0 ? 'Medium' : 'Low', color: uncategorizedCount > 10 ? 'text-red-600' : uncategorizedCount > 0 ? 'text-yellow-600' : 'text-green-600' }
              ]}
            />
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="text-center">
            <Upload className="mx-auto h-16 w-16 text-blue-500 mb-4" />
            <h3 className="text-2xl font-medium text-gray-900 mb-2">
              Upload Bank Statements
            </h3>
            <p className="text-gray-600 mb-6">
              PDF and text files supported - Enhanced with FLIPPABLE ANALYTICS CARDS
            </p>
            
            <div className="bg-purple-50 rounded-lg p-4 mb-6 border-l-4 border-purple-400">
              <div className="flex items-center justify-center mb-3">
                <RotateCcw className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-purple-800 font-medium">NEW: INTERACTIVE FLIPPABLE CARDS</span>
              </div>
              <div className="text-sm text-purple-700 space-y-1">
                <div>• Click any analytics card above to see detailed breakdown</div>
                <div>• 3D flip animation reveals hidden insights and statistics</div>
                <div>• Enhanced user experience with comprehensive data visualization</div>
              </div>
            </div>
            
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
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-800 font-medium">
                      Document Validation Summary
                    </span>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-green-700">{validationSummary.valid} Valid</span>
                      </div>
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                        <span className="text-red-700">{validationSummary.invalid} Invalid</span>
                      </div>
                    </div>
                  </div>
                </div>
                  
                <div className="max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-3">
                    {files.map((file, index) => {
                      const progress = fileProgress[file.name] || { status: 'pending', progress: 0, transactions: 0 };
                      const validation = fileValidationResults[file.name] || { isValid: null, message: 'Validating...' };
                      
                      return (
                        <div key={index} className={`flex items-center rounded-lg p-3 border transition-all duration-300 ${
                          validation.isValid === true ? 'bg-green-50 border-green-200' :
                          validation.isValid === false ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-center flex-1 min-w-0">
                            <div className={`p-2 rounded-lg mr-3 ${
                              validation.isValid === true ? 'bg-green-100' :
                              validation.isValid === false ? 'bg-red-100' :
                              'bg-gray-100'
                            }`}>
                              <FileText className={`h-4 w-4 ${
                                validation.isValid === true ? 'text-green-600' :
                                validation.isValid === false ? 'text-red-600' :
                                'text-gray-400'
                              }`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="truncate text-gray-700 text-sm font-medium">{file.name}</span>
                                <div className="ml-2 flex items-center space-x-2">
                                  <span className="text-gray-400 text-xs flex-shrink-0">
                                    {(file.size / 1024).toFixed(1)}KB
                                  </span>
                                  
                                  {validation.isValid === true && (
                                    <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                      <ThumbsUp className="h-3 w-3 mr-1" />
                                      Valid
                                    </div>
                                  )}
                                  {validation.isValid === false && (
                                    <div className="flex items-center bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Invalid
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-1 text-xs text-gray-600">
                                {validation.message}
                              </div>
                              
                              {processing && progress.status !== 'pending' && validation.isValid && (
                                <div className="mt-2">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-600 capitalize">
                                      {progress.status === 'completed' && progress.transactions > 0 ? 
                                        `${progress.transactions} transactions` : 
                                        progress.status
                                      }
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {progress.progress}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full transition-all duration-300 ${
                                        progress.status === 'completed' ? 'bg-green-500' :
                                        progress.status === 'failed' ? 'bg-red-500' :
                                        'bg-blue-500'
                                      }`}
                                      style={{
                                        width: `${progress.progress}%`
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {progress.status === 'failed' && progress.error && (
                                <div className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                  {progress.error}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {!processing && (
                            <button
                              onClick={() => removeFile(index)}
                              className="ml-2 p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mb-6">
          <button
            onClick={processFiles}
            disabled={processing || !canProcess()}
            className={`px-8 py-4 rounded-lg font-medium text-lg transition-all inline-flex items-center ${
              processing || !canProcess()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            <Play className="h-6 w-6 mr-3" />
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing Validated Files...
              </>
            ) : (
              `Process ${validationSummary.valid} Valid File${validationSummary.valid !== 1 ? 's' : ''}`
            )}
          </button>
        </div>

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

        {results && (
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
                Download Enhanced Report
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
                        <div key={i} className="text-xs text-gray-500 truncate bg-white rounded px-2 py-1 flex justify-between">
                          <span>{t.transactionDate}</span>
                          <span className="font-medium">MUR {t.amount?.toLocaleString()}</span>
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
        )}

        <div className="text-center mt-8 py-6 border-t">
          <p className="text-gray-600 text-sm">
            Enhanced Bank Statement Processor v9.0 - Now with Interactive Flippable Analytics Cards
          </p>
        </div>
      </div>
    </div>
  );
};

export default BankStatementProcessor;
