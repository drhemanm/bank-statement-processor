import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, Info, TrendingUp, DollarSign } from 'lucide-react';

const BankStatementProcessor = () => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [combinePDFs, setCombinePDFs] = useState(false);
  const [fileProgress, setFileProgress] = useState({});import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, Info, TrendingUp, DollarSign } from 'lucide-react';

const BankStatementProcessor = () => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [uncategorizedData, setUncategorizedData] = useState([]);
  const [fileStats, setFileStats] = useState({});
  const [combinePDFs, setCombinePDFs] = useState(false);
  const [fileProgress, setFileProgress] = useState({}); // Track progress per file
  const [processingStats, setProcessingStats] = useState({ completed: 0, total: 0, failed: 0 });
  const fileInputRef = useRef(null);

  // Enhanced mapping rules with more MCB-specific patterns
  const mappingRules = {
    // Bank charges and fees
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

    // Government and official payments
    'JUICE Account Transfer': 'SCHEME (PRIME)',
    'JuicePro Transfer': 'SCHEME (PRIME)',
    'Government Instant Payment': 'SCHEME (PRIME)',
    'MAUBANK': 'SCHEME (PRIME)',
    'SBM BANK': 'SCHEME (PRIME)',
    'MCB BANK': 'SCHEME (PRIME)',

    // CSG and tax related
    'Direct Debit Scheme': 'CSG',
    'MAURITIUS REVENUE AUTHORITY': 'CSG',
    'MRA': 'CSG',
    'CSG CONTRIBUTION': 'CSG',
    'NATIONAL PENSION FUND': 'CSG',
    'NPF': 'CSG',
    'INCOME TAX': 'CSG',
    'VAT': 'CSG',

    // Sales and deposits
    'ATM Cash Deposit': 'SALES',
    'Cash Deposit': 'SALES',
    'DEPOSIT': 'SALES',
    'CREDIT TRANSFER': 'SALES',
    'COLLECTION': 'SALES',
    'PAYMENT RECEIVED': 'SALES',
    'REMITTANCE': 'SALES',

    // Salary payments
    'Cash Cheque': 'Salary',
    'Staff': 'Salary',
    'STAFF': 'Salary',
    'Salary': 'Salary',
    'PAYROLL': 'Salary',
    'WAGES': 'Salary',
    'BONUS': 'Salary',
    'ALLOWANCE': 'Salary',

    // PRGF
    'Interbank Transfer': 'PRGF',
    'TRANSFER TO': 'PRGF',
    'TRANSFER FROM': 'PRGF',
    'FUND TRANSFER': 'PRGF',

    // Miscellaneous
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

    // Transport
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

  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setFiles(uploadedFiles);
    setLogs([]);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    setFileProgress({});
    setProcessingStats({ completed: 0, total: 0, failed: 0 });
    
    // Initialize progress tracking for each file
    const initialProgress = {};
    uploadedFiles.forEach(file => {
      initialProgress[file.name] = {
        status: 'pending',
        progress: 0,
        transactions: 0,
        error: null
      };
    });
    setFileProgress(initialProgress);
    
    addLog(`${uploadedFiles.length} file(s) uploaded successfully`, 'success');
  };

  const removeFile = (indexToRemove) => {
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
    
    // Update progress tracking
    const updatedProgress = { ...fileProgress };
    delete updatedProgress[files[indexToRemove].name];
    setFileProgress(updatedProgress);
    
    addLog(`Removed ${files[indexToRemove].name}`, 'info');
  };

  const updateFileProgress = (fileName, updates) => {
    setFileProgress(prev => ({
      ...prev,
      [fileName]: { ...prev[fileName], ...updates }
    }));
  };

  // Enhanced PDF text extraction (keeping original logic intact)
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
        
        // Enhanced text cleaning for better extraction
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

  // Process single file with progress tracking
  const processSingleFile = async (file) => {
    const fileName = file.name;
    
    try {
      updateFileProgress(fileName, { status: 'processing', progress: 10 });
      addLog(`Starting ${fileName}...`, 'info');

      let extractedText = '';
      
      if (file.type === 'application/pdf') {
        updateFileProgress(fileName, { status: 'extracting', progress: 30 });
        extractedText = await extractTextFromPDF(file);
      } else {
        updateFileProgress(fileName, { status: 'reading', progress: 30 });
        extractedText = await file.text();
        addLog(`Text file processed: ${fileName}`, 'success');
      }

      if (extractedText) {
        updateFileProgress(fileName, { status: 'analyzing', progress: 60 });
        const transactions = extractTransactionsFromText(extractedText, fileName);
        
        updateFileProgress(fileName, { 
          status: 'completed', 
          progress: 100,
          transactions: transactions.length
        });
        
        addLog(`✅ ${fileName}: ${transactions.length} transactions extracted`, 'success');
        
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
      
      addLog(`❌ ${fileName}: ${error.message}`, 'error');
      
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
    
      // Enhanced patterns for MCB statements
    const mcbPattern1 = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
    
    // Pattern 2: Alternative format with negative amounts: DD/MM/YYYY DD/MM/YYYY -AMOUNT BALANCE DESCRIPTION
    const mcbPattern2 = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
    
    addLog(`Searching for MCB transaction patterns...`, 'info');
    
    let transactionCount = 0;
    const patterns = [mcbPattern1, mcbPattern2];
    
    // Try each pattern
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      let match;
      
      addLog(`Trying pattern ${patternIndex + 1}...`, 'info');
      
      while ((match = pattern.exec(text)) !== null) {
        const [fullMatch, transDate, valueDate, amount, balance, description] = match;
        
        // Clean up the extracted data
        const cleanDescription = description.trim().replace(/\s+/g, ' ').replace(/[\r\n]/g, '');
        const transactionAmount = parseFloat(amount.replace(/,/g, ''));
        const balanceAmount = parseFloat(balance.replace(/,/g, ''));
        
        // Validation checks
        if (cleanDescription.toLowerCase().includes('trans date') ||
            cleanDescription.toLowerCase().includes('statement page') ||
            cleanDescription.toLowerCase().includes('account number') ||
            cleanDescription.toLowerCase().includes('balance forward') ||
            isNaN(transactionAmount) || 
            cleanDescription.length < 3) {
          addLog(`Skipping header/invalid: "${cleanDescription.substring(0, 50)}..."`, 'info');
          continue;
        }
        
        // Check for duplicate transactions
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
          amount: Math.abs(transactionAmount), // Always use absolute value
          balance: Math.abs(balanceAmount),
          sourceFile: fileName,
          originalLine: fullMatch.trim(),
          rawAmount: amount, // Keep original for debugging
          isDebit: transactionAmount < 0 || amount.includes('-')
        });
        
        transactionCount++;
        addLog(`Transaction ${transactionCount}: ${transDate} - ${cleanDescription.substring(0, 40)}... - MUR ${Math.abs(transactionAmount)} ${transactionAmount < 0 ? '(Debit)' : '(Credit)'}`, 'success');
      }
      
      // If we found transactions with this pattern, don't try others
      if (transactionCount > 0) {
        addLog(`Pattern ${patternIndex + 1} successful - ${transactionCount} transactions found`, 'success');
        break;
      }
    }
    
    // Line-by-line fallback (keeping original logic)
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

  // Keep original balance extraction functions intact
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

  // Enhanced categorization with fuzzy matching
  const categorizeTransaction = (description) => {
    const desc = description.toLowerCase();
    
    // Direct keyword matching (keep original logic)
    for (const [keyword, category] of Object.entries(mappingRules)) {
      if (desc.includes(keyword.toLowerCase())) {
        return { category, matched: true, keyword, confidence: 'high' };
      }
    }
    
    // Enhanced fuzzy matching for partial matches
    const fuzzyMatches = [];
    
    for (const [keyword, category] of Object.entries(mappingRules)) {
      const keywordLower = keyword.toLowerCase();
      const words = keywordLower.split(' ');
      
      // Check if any words from the keyword appear in description
      const matchingWords = words.filter(word => desc.includes(word));
      
      if (matchingWords.length > 0) {
        const confidence = matchingWords.length / words.length;
        if (confidence >= 0.6) { // 60% of words must match
          fuzzyMatches.push({ category, keyword, confidence });
        }
      }
    }
    
    // Return best fuzzy match if any
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

  // Enhanced parallel processing
  const processFiles = async () => {
    if (files.length === 0) {
      addLog('Please upload files first', 'error');
      return;
    }

    setProcessing(true);
    setResults(null);
    setUncategorizedData([]);
    setFileStats({});
    setProcessingStats({ completed: 0, total: files.length, failed: 0 });
    
    addLog(`Starting parallel processing of ${files.length} files...`, 'info');

    try {
      // Process files in parallel with concurrency limit
      const concurrencyLimit = 3; // Process max 3 files simultaneously
      const results = [];
      
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(file => processSingleFile(file));
        
        addLog(`Processing batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(files.length/concurrencyLimit)}...`, 'info');
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Update overall progress
        setProcessingStats(prev => ({
          ...prev,
          completed: results.length,
          failed: results.filter(r => !r.success).length
        }));
      }

      // Combine all results
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

      // Process categorization
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
      addLog(`Files: ${files.length - totalFailed}/${files.length} successful`, totalFailed > 0 ? 'error' : 'success');
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

  // Enhanced Excel generation with better formatting
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
      
      // Enhanced Summary Report
      const summaryData = [
        ['ENHANCED BANK STATEMENT PROCESSING REPORT'],
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
      
      // All Transactions Sheet (keep original format)
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
      
      // Category Analysis Sheet
      const categoryData = [
        ['CATEGORY ANALYSIS'],
        ['Category', 'Transaction Count', 'Total Amount (MUR)', 'Average Amount', 'Min Amount', 'Max Amount']
      ];
      
      Object.entries(results).forEach(([category, transactions]) => {
        if (transactions.length > 0) {
          const amounts = transactions.map(t => t.amount);
          const total = amounts.reduce((sum, amt) => sum + amt, 0);
          const avg = total / amounts.length;
          const min = Math.min(...amounts);
          const max = Math.max(...amounts);
          
          categoryData.push([
            category,
            transactions.length,
            total.toFixed(2),
            avg.toFixed(2),
            min.toFixed(2),
            max.toFixed(2)
          ]);
        }
      });
      
      const categoryWS = XLSX.utils.aoa_to_sheet(categoryData);
      XLSX.utils.book_append_sheet(wb, categoryWS, "Category Analysis");
      
      // Uncategorized Items Sheet (if any)
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
            '', // For AI suggestions in future
            '' // Empty column for manual categorization
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
      a.download = `Enhanced_Bank_Statements_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      addLog('Enhanced Excel report with category analysis downloaded!', 'success');
    });
  };

  // Keep original balance stats calculation
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

  const { totalTransactions, openingBalance, closingBalance, categories, categorizedCount, uncategorizedCount } = getBalanceStats();
  const successRate = totalTransactions > 0 ? ((categorizedCount / totalTransactions) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Enhanced Bank Statement Processor
          </h1>
          <p className="text-gray-600 text-lg">
            Advanced PDF processing with improved pattern matching and categorization
          </p>
        </div>

        {/* Enhanced Quick Stats */}
        {results && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-500 mr-2" />
                <div>
                  <div className="text-2xl font-bold text-blue-600">{totalTransactions}</div>
                  <div className="text-sm text-gray-600">Total Transactions</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500 mr-2" />
                <div>
                  <div className="text-2xl font-bold text-green-600">{categorizedCount}</div>
                  <div className="text-sm text-gray-600">Categorized ({successRate}%)</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-500 mr-2" />
                <div>
                  <div className="text-2xl font-bold text-blue-600">MUR {openingBalance.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Opening Balance</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-500 mr-2" />
                <div>
                  <div className="text-2xl font-bold text-green-600">MUR {closingBalance.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Closing Balance</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center">
                <AlertCircle className={`h-8 w-8 ${uncategorizedCount > 0 ? 'text-yellow-500' : 'text-green-500'} mr-2`} />
                <div>
                  <div className={`text-2xl font-bold ${uncategorizedCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {uncategorizedCount}
                  </div>
                  <div className="text-sm text-gray-600">Need Review</div>
                </div>
              </div>
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
              PDF and text files supported - Enhanced pattern recognition for MCB statements
            </p>
            
            {/* Toggle for combining PDFs */}
            <div className="mb-6">
              <label className="flex items-center justify-center space-x-3">
                <input
                  type="checkbox"
                  checked={combinePDFs}
                  onChange={(e) => setCombinePDFs(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700 font-medium">
                  Combine all files into single Excel sheet
                </span>
              </label>
              <p className="text-sm text-gray-500 mt-1 text-center">
                {combinePDFs ? "All transactions will be merged into one report" : "Each file will be processed separately"}
              </p>
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
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-blue-800 font-medium mb-3">
                    {files.length} files selected
                  </p>
                  
                  {/* Overall Progress Bar */}
                  {processing && (
                    <div className="mb-4 p-3 bg-white rounded border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm text-gray-600">
                          {processingStats.completed}/{processingStats.total} files
                          {processingStats.failed > 0 && <span className="text-red-600"> ({processingStats.failed} failed)</span>}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(processingStats.completed / processingStats.total) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-3">
                      {files.map((file, index) => {
                        const progress = fileProgress[file.name] || { status: 'pending', progress: 0, transactions: 0 };
                        return (
                          <div key={index} className="flex items-center bg-white rounded p-3 border">
                            {/* File Icon and Info */}
                            <div className="flex items-center flex-1 min-w-0">
                              <FileText className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="truncate text-gray-700 text-sm font-medium">{file.name}</span>
                                  <span className="ml-2 text-gray-400 text-xs flex-shrink-0">
                                    {(file.size / 1024).toFixed(1)}KB
                                  </span>
                                </div>
                                
                                {/* Progress Bar for Individual File */}
                                {processing && progress.status !== 'pending' && (
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
                                
                                {/* Error Message */}
                                {progress.status === 'failed' && progress.error && (
                                  <div className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                    {progress.error}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Remove Button */}
                            {!processing && (
                              <button
                                onClick={() => removeFile(index)}
                                className="ml-2 text-red-400 hover:text-red-600 p-1"
                                title="Remove file"
                              >
                                ✕
                              </button>
                            )}
                            
                            {/* Status Indicator */}
                            <div className="ml-2 flex-shrink-0">
                              {progress.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                              {progress.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
                              {progress.status === 'processing' && <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                              {progress.status === 'pending' && <div className="h-4 w-4 bg-gray-300 rounded-full" />}
                            </div>
                          </div>
                        );
                      })}
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
                Processing with Enhanced Intelligence...
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

        {/* Results Section - Keep original structure */}
        {results && (
          <div className="space-y-6">
            
            {/* File Processing Stats - Enhanced */}
            {Object.keys(fileStats).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-xl font-medium text-gray-800 mb-4">File Processing Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(fileStats).filter(([key]) => key !== 'balanceInfo').map(([fileName, stats]) => (
                    <div key={fileName} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 text-sm mb-2 truncate" title={fileName}>
                        {fileName}
                      </h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Transactions:</span>
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
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-600">Opening:</span>
                            <span className="font-medium text-blue-600">MUR {stats.openingBalance?.toLocaleString() || '0'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600">Closing:</span>
                            <span className="font-medium text-green-600">MUR {stats.closingBalance?.toLocaleString() || '0'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-1">
                          <span className="text-gray-600">Success Rate:</span>
                          <span className="font-medium text-gray-600">
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

            {/* Keep original uncategorized section */}
            {uncategorizedData.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6">
                <div className="flex items-start">
                  <AlertCircle className="h-6 w-6 text-yellow-600 mr-3 mt-1" />
                  <div>
                    <h3 className="text-lg font-medium text-yellow-800 mb-2">
                      {uncategorizedData.length} Transactions Need Manual Review
                    </h3>
                    <p className="text-yellow-700 mb-4">
                      These transactions couldn't be automatically categorized using enhanced patterns. 
                      They're included in your download for manual classification.
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

        {/* Enhanced Features Section */}
        <div className="mt-8 bg-green-50 border rounded-xl p-6">
          <h3 className="text-lg font-medium text-green-800 mb-4">Enhanced System Features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-green-700 mb-2">Improved Pattern Recognition</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Enhanced MCB statement parsing</li>
                <li>• Better duplicate detection</li>
                <li>• Improved date format handling</li>
                <li>• Fuzzy keyword matching</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-700 mb-2">Advanced Categorization</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Expanded mapping rules</li>
                <li>• Confidence scoring</li>
                <li>• Multi-word keyword matching</li>
                <li>• Enhanced validation checks</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-700 mb-2">Professional Reporting</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Category analysis sheet</li>
                <li>• Statistical summaries</li>
                <li>• Confidence indicators</li>
                <li>• Better Excel formatting</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-6 border-t">
          <p className="text-gray-600 text-sm">
            Enhanced Bank Statement Processor v7.0 - Improved Pattern Recognition & Categorization
          </p>
        </div>
      </div>
    </div>
  );
};

export default BankStatementProcessor;

  const [processingStats, setProcessingStats] = useState({ completed: 0, total: 0, failed: 0 });
  const fileInputRef = useRef(null);

  // Enhanced mapping rules with more MCB-specific patterns
  const mappingRules = {
    'Business Banking Subs Fee': 'BANK CHARGES',
    'Standing order Charges': 'BANK CHARGES',
    'JUICE Account Transfer': 'SCHEME (PRIME)',
    'JuicePro Transfer': 'SCHEME (PRIME)',
    'Government Instant Payment': 'SCHEME (PRIME)',
    'Direct Debit Scheme': 'CSG',
    'MAURITIUS REVENUE AUTHORITY': 'CSG',
    'ATM Cash Deposit': 'SALES',
    'Cash Cheque': 'Salary',
    'Staff': 'Salary',
    'STAFF': 'Salary',
    'Salary': 'Salary',
    'Interbank Transfer': 'PRGF',
    'Merchant Instant Payment': 'MISCELLANEOUS',
    'Refill Amount': 'MISCELLANEOUS',
    'VAT on Refill': 'MISCELLANEOUS',
    'SHELL': 'MISCELLANEOUS'
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
    setFileProgress({});
    setProcessingStats({ completed: 0, total: 0, failed: 0 });
    
    const initialProgress = {};
    uploadedFiles.forEach(file => {
      initialProgress[file.name] = {
        status: 'pending',
        progress: 0,
        transactions: 0,
        error: null
      };
    });
    setFileProgress(initialProgress);
    
    addLog(`${uploadedFiles.length} file(s) uploaded successfully`, 'success');
  };

  const removeFile = (indexToRemove) => {
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
    
    const updatedProgress = { ...fileProgress };
    delete updatedProgress[files[indexToRemove].name];
    setFileProgress(updatedProgress);
    
    addLog(`Removed ${files[indexToRemove].name}`, 'info');
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
      updateFileProgress(fileName, { status: 'processing', progress: 10 });
      addLog(`Starting ${fileName}...`, 'info');

      let extractedText = '';
      
      if (file.type === 'application/pdf') {
        updateFileProgress(fileName, { status: 'extracting', progress: 30 });
        extractedText = await extractTextFromPDF(file);
      } else {
        updateFileProgress(fileName, { status: 'reading', progress: 30 });
        extractedText = await file.text();
        addLog(`Text file processed: ${fileName}`, 'success');
      }

      if (extractedText) {
        updateFileProgress(fileName, { status: 'analyzing', progress: 60 });
        const transactions = extractTransactionsFromText(extractedText, fileName);
        
        updateFileProgress(fileName, { 
          status: 'completed', 
          progress: 100,
          transactions: transactions.length
        });
        
        addLog(`✅ ${fileName}: ${transactions.length} transactions extracted`, 'success');
        
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
      
      addLog(`❌ ${fileName}: ${error.message}`, 'error');
      
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
        addLog(`Transaction ${transactionCount}: ${transDate} - ${cleanDescription.substring(0, 40)}... - MUR ${Math.abs(transactionAmount)}`, 'success');
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
    
    return { category: 'UNCATEGORIZED', matched: false, keyword: null, confidence: 'none' };
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
    setProcessingStats({ completed: 0, total: files.length, failed: 0 });
    
    addLog(`Starting parallel processing of ${files.length} files...`, 'info');

    try {
      const concurrencyLimit = 3;
      const results = [];
      
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(file => processSingleFile(file));
        
        addLog(`Processing batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(files.length/concurrencyLimit)}...`, 'info');
        
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
      addLog(`Files: ${files.length - totalFailed}/${files.length} successful`, totalFailed > 0 ? 'error' : 'success');
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
        ['ENHANCED BANK STATEMENT PROCESSING REPORT'],
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
      a.download = `Enhanced_Bank_Statements_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      addLog('Enhanced Excel report downloaded!', 'success');
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

  const { totalTransactions, openingBalance, closingBalance, categories, categorizedCount, uncategorizedCount } = getBalanceStats();
  const successRate = totalTransactions > 0 ? ((categorizedCount / totalTransactions) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        
        {/* Modern Header */}
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl mb-6 shadow-xl">
            <FileText className="h-10 w-10 text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 bg-clip-text text-transparent mb-3">
            Smart Bank Statement Processor
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Advanced PDF processing with AI-powered pattern recognition and intelligent categorization
          </p>
        </div>

        {/* Modern Stats Dashboard */}
        {results && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  TOTAL
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{totalTransactions.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Transactions Processed</div>
            </div>
            
            <div className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500/10 rounded-xl group-hover:bg-green-500/20 transition-colors">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {successRate}%
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{categorizedCount.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Successfully Categorized</div>
            </div>
            
            <div className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                  <TrendingUp className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  OPENING
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">MUR {openingBalance.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Starting Balance</div>
            </div>
            
            <div className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  CLOSING
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">MUR {closingBalance.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Final Balance</div>
            </div>
            
            <div className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl transition-colors ${
                  uncategorizedCount > 0 
                    ? 'bg-amber-500/10 group-hover:bg-amber-500/20' 
                    : 'bg-green-500/10 group-hover:bg-green-500/20'
                }`}>
                  <AlertCircle className={`h-6 w-6 ${uncategorizedCount > 0 ? 'text-amber-600' : 'text-green-600'}`} />
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                  uncategorizedCount > 0 
                    ? 'text-amber-600 bg-amber-50' 
                    : 'text-green-600 bg-green-50'
                }`}>
                  {uncategorizedCount > 0 ? 'REVIEW' : 'CLEAN'}
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${
                uncategorizedCount > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {uncategorizedCount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                {uncategorizedCount > 0 ? 'Need Manual Review' : 'All Categorized'}
              </div>
            </div>
          </div>
        )}

        {/* Modern Upload Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30 p-8 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-3xl"></div>
          <div className="relative z-10">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-6 shadow-lg">
                <Upload className="h-12 w-12 text-white" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Upload Your Bank Statements
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto">
                Drag & drop your PDF files or browse to select. Our AI will intelligently extract and categorize all transactions.
              </p>
              
              <div className="mb-8 p-4 bg-white/50 rounded-2xl border border-white/40 backdrop-blur-sm inline-block">
                <label className="flex items-center space-x-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={combinePDFs}
                    onChange={(e) => setCombinePDFs(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                    combinePDFs ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-lg ${
                      combinePDFs ? 'transform translate-x-7' : ''
                    }`}></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-gray-800 font-semibold">
                      Combine into Single Report
                    </span>
                    <span className="text-sm text-gray-500">
                      {combinePDFs ? "All transactions will be merged" : "Process files separately"}
                    </span>
                  </div>
                </label>
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
                className="group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 inline-flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <Upload className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                Select Bank Statements
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                Supports PDF, TXT, and CSV files • Multiple files allowed • Secure processing
              </p>

              {files.length > 0 && (
                <div className="mt-8">
                  <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <h4 className="text-lg font-semibold text-gray-800">
                          {files.length} File{files.length !== 1 ? 's' : ''} Ready for Processing
                        </h4>
                      </div>
                      {!processing && (
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          {(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB total
                        </span>
                      )}
                    </div>
                    
                    {processing && (
                      <div className="mb-6 p-4 bg-white/60 rounded-xl border border-white/40">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                            <span className="font-semibold text-gray-800">Processing Files</span>
                          </div>
                          <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-lg shadow-sm">
                            {processingStats.completed}/{processingStats.total} completed
                            {processingStats.failed > 0 && (
                              <span className="ml-2 text-red-600 font-medium">
                                ({processingStats.failed} failed)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                            style={{
                              width: `${(processingStats.completed / processingStats.total) * 100}%`
                            }}
                          >
                            <div className="h-full bg-white/20 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="max-h-80 overflow-y-auto space-y-3">
                      {files.map((file, index) => {
                        const progress = fileProgress[file.name] || { status: 'pending', progress: 0, transactions: 0 };
                        const isCompleted = progress.status === 'completed';
                        const isFailed = progress.status === 'failed';
                        const isProcessing = processing && !isCompleted && !isFailed;
                        
                        return (
                          <div key={index} className={`group bg-white/60 backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 ${
                            isCompleted ? 'border-green-200 bg-green-50/50' :
                            isFailed ? 'border-red-200 bg-red-50/50' :
                            isProcessing ? 'border-blue-200 bg-blue-50/50' :
                            'border-white/40 hover:border-white/60'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg transition-colors ${
                                  isCompleted ? 'bg-green-100' :
                                  isFailed ? 'bg-red-100' :
                                  isProcessing ? 'bg-blue-100' :
                                  'bg-gray-100 group-hover:bg-gray-200'
                                }`}>
                                  <FileText className={`h-5 w-5 ${
                                    isCompleted ? 'text-green-600' :
                                    isFailed ? 'text-red-600' :
                                    isProcessing ? 'text-blue-600' :
                                    'text-gray-500'
                                  }`} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <h5 className="font-medium text-gray-900 truncate pr-2">
                                      {file.name}
                                    </h5>
                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                      <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded">
                                        {(file.size / 1024).toFixed(1)}KB
                                      </span>
                                      {isCompleted && progress.transactions > 0 && (
                                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                          {progress.transactions} transactions
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {processing && progress.status !== 'pending' && (
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-medium capitalize ${
                                          isCompleted ? 'text-green-700' :
                                          isFailed ? 'text-red-700' :
                                          'text-blue-700'
                                        }`}>
                                          {progress.status === 'completed' && progress.transactions > 0 ? 
                                            `Extracted ${progress.transactions} transactions` : 
                                            progress.status
                                          }
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                          {progress.progress}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 shadow-inner">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            isCompleted ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                            isFailed ? 'bg-gradient-to-r from-red-400 to-red-600' :
                                            'bg-gradient-to-r from-blue-400 to-blue-600'
                                          }`}
                                          style={{ width: `${progress.progress}%` }}
                                        >
                                          {isProcessing && (
                                            <div className="h-full bg-white/30 rounded-full animate-pulse"></div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {progress.status === 'failed' && progress.error && (
                                    <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                      <span className="font-medium">Error:</span> {progress.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2 ml-4">
                                <div className="flex-shrink-0">
                                  {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                                  {isFailed && <AlertCircle className="h-5 w-5 text-red-500" />}
                                  {isProcessing && (
                                    <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  )}
                                  {progress.status === 'pending' && (
                                    <div className="h-5 w-5 bg-gray-300 rounded-full"></div>
                                  )}
                                </div>
                                
                                {!processing && (
                                  <button
                                    onClick={() => removeFile(index)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove file"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Process Button */}
        <div className="text-center mb-8">
          <button
            onClick={processFiles}
            disabled={processing || files.length === 0}
            className={`group relative px-12 py-5 rounded-2xl font-bold text-xl transition-all duration-300 inline-flex items-center overflow-hidden ${
              processing || files.length === 0
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1'
            }`}
          >
            {!processing && files.length > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            )}
            
            <div className="relative z-10 flex items-center">
              {processing ? (
                <>
                  <div className="relative mr-4">
                    <div className="animate-spin rounded-full h-7 w-7 border-3 border-white border-t-transparent"></div>
                    <div className="absolute inset-0 animate-ping rounded-full h-7 w-7 border border-white/30"></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span>Processing with AI Intelligence...</span>
                    <span className="text-sm font-normal opacity-90">
                      {processingStats.completed}/{processingStats.total} files completed
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative mr-4">
                    <Play className="h-7 w-7 group-hover:scale-110 transition-transform duration-300" />
                    {files.length > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{files.length}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span>
                      {files.length === 0 
                        ? 'Select Files to Process'
                        : `Process ${files.length} Statement${files.length !== 1 ? 's' : ''}`
                      }
                    </span>
                    {files.length > 0 && (
                      <span className="text-sm font-normal opacity-90">
                        Advanced AI pattern recognition
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </button>
          
          {files.length > 0 && !processing && (
            <p className="text-sm text-gray-500 mt-3">
              Ready to extract transactions from {files.length} file{files.length !== 1 ? 's' : ''} • 
              Estimated processing time: ~{Math.ceil(files.length * 0.5)} minute{Math.ceil(files.length * 0.5) !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Modern Processing Logs */}
        {logs.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Processing Logs</h3>
                  <p className="text-sm text-gray-500">Real-time AI processing updates</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-600">
                  {logs.filter(l => l.type === 'success').length} success • 
                  {logs.filter(l => l.type === 'error').length} errors
                </span>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-4 max-h-96 overflow-y-auto font-mono text-sm">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-3 py-1 hover:bg-gray-800/50 rounded px-2 transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-400" />}
                      {log.type === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                      {log.type === 'info' && <div className="h-2 w-2 bg-blue-400 rounded-full mt-1.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-400 text-xs mr-3 font-mono">{log.timestamp}</span>
                      <span className={`${
                        log.type === 'error' ? 'text-red-300' : 
                        log.type === 'success' ? 'text-green-300' : 
                        'text-gray-300'
                      } leading-relaxed`}>
                        {log.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {processing && (
                <div className="flex items-center space-x-2 mt-3 py-2 px-2 bg-blue-900/30 rounded">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                  <span className="text-blue-300 text-xs">Processing in progress...</span>
                </div>
              )}
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
                  {Object.entries(fileStats).filter(([key]) => key !== 'balanceInfo').map(([fileName, stats]) => (
                    <div key={fileName} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 text-sm mb-2 truncate" title={fileName}>
                        {fileName}
                      </h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Transactions:</span>
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
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-600">Opening:</span>
                            <span className="font-medium text-blue-600">MUR {stats.openingBalance?.toLocaleString() || '0'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600">Closing:</span>
                            <span className="font-medium text-green-600">MUR {stats.closingBalance?.toLocaleString() || '0'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-1">
                          <span className="text-gray-600">Success Rate:</span>
                          <span className="font-medium text-gray-600">
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
