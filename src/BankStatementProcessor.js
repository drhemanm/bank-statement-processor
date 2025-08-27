import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Play, Info, TrendingUp, DollarSign, ThumbsUp, AlertTriangle, Shield, X } from 'lucide-react';

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

  // Document validation function
  const validateDocument = async (pdf, fileName) => {
    try {
      addLog(`Validating document: ${fileName}...`, 'info');
      
      // Basic file validation
      if (pdf.numPages === 0) {
        return {
          isValid: false,
          type: 'invalid',
          message: 'Empty PDF document',
          suggestion: 'Please upload a valid PDF file with content.'
        };
      }

      if (pdf.numPages > 50) {
        return {
          isValid: false,
          type: 'invalid',
          message: 'Document too large (over 50 pages)',
          suggestion: 'Bank statements typically have fewer than 50 pages. Please verify this is the correct document.'
        };
      }

      // Extract text from first few pages for analysis
      let sampleText = '';
      const pagesToCheck = Math.min(3, pdf.numPages);
      
      for (let pageNum = 1; pageNum <= pagesToCheck; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        sampleText += pageText + '\n';
      }

      return analyzeDocumentContent(sampleText, fileName, pdf.numPages);

    } catch (error) {
      return {
        isValid: false,
        type: 'error',
        message: 'Failed to validate document',
        suggestion: 'Please try uploading the file again or contact support.'
      };
    }
  };

  // Content analysis function
  const analyzeDocumentContent = (text, fileName, totalPages) => {
    const textLength = text.length;
    const meaningfulLines = text.split('\n').filter(line => 
      line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
    ).length;

    addLog(`Analyzing document content: ${textLength} characters, ${meaningfulLines} meaningful lines`, 'info');

    // Banking keywords to look for (more comprehensive)
    const bankingKeywords = [
      'statement', 'account', 'balance', 'transaction', 'credit', 'debit',
      'deposit', 'withdrawal', 'transfer', 'payment', 'bank', 'mcb',
      'mauritius commercial bank', 'account number', 'statement period',
      'opening balance', 'closing balance', 'current balance', 'brought forward',
      'carried forward', 'trans date', 'value date'
    ];

    const currencyPatterns = ['MUR', 'Rs', 'rupees', 'mauritius rupees'];
    const datePatterns = /\d{2}\/\d{2}\/\d{4}/g;
    const amountPatterns = /[\d,]+\.?\d*\s*(?:MUR|Rs|rupees)/gi;

    // Count matches
    const bankingKeywordMatches = bankingKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    const currencyMatches = currencyPatterns.filter(pattern => 
      text.toLowerCase().includes(pattern.toLowerCase())
    ).length;
    
    const dateMatches = (text.match(datePatterns) || []).length;
    const amountMatches = (text.match(amountPatterns) || []).length;

    // Text density analysis (more strict for scanned detection)
    const textDensity = textLength / totalPages;
    const avgMeaningfulLinesPerPage = meaningfulLines / totalPages;
    
    // Character variety analysis (scanned PDFs often have limited character sets)
    const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, '')).size;
    const charVariety = uniqueChars / Math.min(textLength, 100); // Normalize

    addLog(`Analysis results - Banking terms: ${bankingKeywordMatches}, Currency: ${currencyMatches}, Dates: ${dateMatches}, Amounts: ${amountMatches}`, 'info');
    addLog(`Text density: ${textDensity.toFixed(1)} chars/page, Line density: ${avgMeaningfulLinesPerPage.toFixed(1)} lines/page`, 'info');

    // 1. SCANNED DOCUMENT DETECTION (more sensitive)
    if (textDensity < 200 || avgMeaningfulLinesPerPage < 15 || charVariety < 0.3) {
      return {
        isValid: false,
        type: 'scanned',
        confidence: textDensity < 100 ? 'high' : 'medium',
        message: '🖼️ Scanned document detected - contains mostly images',
        suggestion: 'This appears to be a scanned PDF with images instead of searchable text. For best results, please request a digital/text-based statement from your bank, or consider our premium OCR service for image processing.',
        details: {
          textDensity: Math.round(textDensity),
          meaningfulLines,
          avgLinesPerPage: Math.round(avgMeaningfulLinesPerPage * 10) / 10,
          charVariety: Math.round(charVariety * 100) / 100
        }
      };
    }

    // 2. WRONG DOCUMENT TYPE DETECTION (more comprehensive)
    if (bankingKeywordMatches < 2 && currencyMatches === 0 && dateMatches < 3) {
      const detectedContent = [];
      
      // Check what type of document this might be
      if (text.toLowerCase().includes('invoice') || text.toLowerCase().includes('receipt')) {
        detectedContent.push('invoice/receipt');
      }
      if (text.toLowerCase().includes('contract') || text.toLowerCase().includes('agreement')) {
        detectedContent.push('contract/agreement');
      }
      if (text.toLowerCase().includes('report') && !text.toLowerCase().includes('account')) {
        detectedContent.push('report');
      }
      
      const detectedType = detectedContent.length > 0 ? ` (appears to be ${detectedContent.join(' or ')})` : '';
      
      return {
        isValid: false,
        type: 'wrong_document',
        confidence: 'high',
        message: `❌ This does not appear to be a bank statement${detectedType}`,
        suggestion: 'Please upload a bank statement document. Expected content includes account details, transaction dates, amounts with currency, and balance information.',
        details: {
          bankingKeywords: bankingKeywordMatches,
          currencyMatches,
          dateMatches,
          detectedContent
        }
      };
    }

    // 3. LOW QUALITY DETECTION
    if (avgMeaningfulLinesPerPage < 8 || textDensity < 150) {
      return {
        isValid: false,
        type: 'low_quality',
        confidence: 'medium',
        message: '⚠️ Low quality document or insufficient content detected',
        suggestion: 'This document may be corrupted, have low text quality, or contain insufficient transaction data. Please verify the document quality or try a different format.',
        details: {
          avgLinesPerPage: Math.round(avgMeaningfulLinesPerPage * 10) / 10,
          textDensity: Math.round(textDensity)
        }
      };
    }

    // 4. VALIDATION SUCCESSFUL
    const confidenceScore = Math.min(100, 
      (bankingKeywordMatches * 8) + 
      (currencyMatches * 12) + 
      (dateMatches * 2) + 
      (amountMatches * 3) +
      (textDensity > 500 ? 20 : 10)
    );

    const confidenceLevel = confidenceScore > 70 ? 'high' : confidenceScore > 50 ? 'medium' : 'low';

    return {
      isValid: true,
      type: 'valid_statement',
      confidence: confidenceLevel,
      message: '✅ Valid bank statement detected - Ready for processing!',
      suggestion: 'Document appears to be a proper bank statement with searchable transaction data. Processing should work optimally.',
      details: {
        confidenceScore: Math.round(confidenceScore),
        bankingKeywords: bankingKeywordMatches,
        currencyMatches,
        dateMatches,
        amountMatches,
        textDensity: Math.round(textDensity),
        avgLinesPerPage: Math.round(avgMeaningfulLinesPerPage * 10) / 10
      }
    };
  };

  // Enhanced file upload with validation
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
    
    // Initialize progress tracking for each file
    const initialProgress = {};
    const validationResults = {};
    
    uploadedFiles.forEach(file => {
      initialProgress[file.name] = {
        status: 'validating',
        progress: 0,
        transactions: 0,
        error: null
      };
      validationResults[file.name] = {
        isValid: null,
        type: 'pending',
        message: 'Validating...'
      };
    });
    
    setFileProgress(initialProgress);
    setFileValidationResults(validationResults);
    
    addLog(`${uploadedFiles.length} file(s) uploaded - starting validation...`, 'info');

    // Validate each file
    for (const file of uploadedFiles) {
      await validateUploadedFile(file);
    }
  };

  const validateUploadedFile = async (file) => {
    const fileName = file.name;
    
    try {
      // Set initial validating state
      setFileValidationResults(prev => ({
        ...prev,
        [fileName]: {
          isValid: null,
          type: 'validating',
          message: 'Analyzing document content...'
        }
      }));

      if (file.type === 'application/pdf') {
        addLog(`Starting validation for PDF: ${fileName}`, 'info');
        
        // Load PDF for validation
        if (!window.pdfjsLib) {
          addLog('Loading PDF.js library...', 'info');
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = () => {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              addLog('PDF.js library loaded successfully', 'success');
              resolve();
            };
          });
        }

        addLog(`Loading PDF document: ${fileName}`, 'info');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        addLog(`PDF loaded successfully: ${pdf.numPages} pages`, 'success');
        const validation = await validateDocument(pdf, fileName);
        
        // Update validation results with detailed feedback
        setFileValidationResults(prev => ({
          ...prev,
          [fileName]: validation
        }));

        setFileProgress(prev => ({
          ...prev,
          [fileName]: {
            ...prev[fileName],
            status: validation.isValid ? 'validated' : 'validation_failed',
            progress: validation.isValid ? 25 : 0
          }
        }));

        if (validation.isValid) {
          addLog(`✅ ${fileName}: Valid bank statement detected! Ready for processing.`, 'success');
        } else {
          addLog(`❌ ${fileName}: ${validation.message} - ${validation.suggestion}`, 'error');
        }

      } else if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        addLog(`Validating text file: ${fileName}`, 'info');
        
        // Read a sample of the text file for basic validation
        const text = await file.text();
        const sampleText = text.substring(0, 2000); // First 2KB for analysis
        
        // Basic text file validation
        let validation;
        if (sampleText.length < 100) {
          validation = {
            isValid: false,
            type: 'empty_file',
            message: 'File appears to be empty or too small',
            suggestion: 'Please ensure the file contains transaction data.'
          };
        } else if (!sampleText.match(/\d{2}\/\d{2}\/\d{4}/) && !sampleText.toLowerCase().includes('transaction')) {
          validation = {
            isValid: false,
            type: 'wrong_format',
            message: 'Text file does not appear to contain transaction data',
            suggestion: 'Please upload a file with transaction records including dates and amounts.'
          };
        } else {
          validation = {
            isValid: true,
            type: 'text_file',
            message: 'Text file validated successfully',
            suggestion: 'Text file will be processed directly.'
          };
        }

        setFileValidationResults(prev => ({
          ...prev,
          [fileName]: validation
        }));

        setFileProgress(prev => ({
          ...prev,
          [fileName]: {
            ...prev[fileName],
            status: validation.isValid ? 'validated' : 'validation_failed',
            progress: validation.isValid ? 25 : 0
          }
        }));

        if (validation.isValid) {
          addLog(`✅ ${fileName}: Text file validated successfully`, 'success');
        } else {
          addLog(`❌ ${fileName}: ${validation.message}`, 'error');
        }
      } else {
        // Unsupported file type
        const validation = {
          isValid: false,
          type: 'unsupported',
          message: 'Unsupported file type',
          suggestion: 'Please upload PDF, TXT, or CSV files only.'
        };

        setFileValidationResults(prev => ({
          ...prev,
          [fileName]: validation
        }));

        setFileProgress(prev => ({
          ...prev,
          [fileName]: {
            ...prev[fileName],
            status: 'validation_failed',
            progress: 0
          }
        }));

        addLog(`❌ ${fileName}: Unsupported file type`, 'error');
      }
    } catch (error) {
      addLog(`Validation error for ${fileName}: ${error.message}`, 'error');
      
      const validation = {
        isValid: false,
        type: 'error',
        message: `Validation failed: ${error.message}`,
        suggestion: 'Please try uploading the file again or check if the file is corrupted.'
      };

      setFileValidationResults(prev => ({
        ...prev,
        [fileName]: validation
      }));

      setFileProgress(prev => ({
        ...prev,
        [fileName]: {
          ...prev[fileName],
          status: 'validation_failed',
          progress: 0
        }
      }));
    }
  };

  const removeFile = (indexToRemove) => {
    const fileToRemove = files[indexToRemove];
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
    
    // Update progress tracking
    const updatedProgress = { ...fileProgress };
    delete updatedProgress[fileToRemove.name];
    setFileProgress(updatedProgress);

    // Update validation results
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

  // Enhanced PDF text extraction with validation integration
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

  // Process single file with enhanced validation
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
        ['ENHANCED BANK STATEMENT PROCESSING REPORT - WITH DOCUMENT VALIDATION'],
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
      addLog('Enhanced Excel report with document validation details downloaded!', 'success');
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

  const { totalTransactions, openingBalance, closingBalance, categories, categorizedCount, uncategorizedCount } = getBalanceStats();
  const successRate = totalTransactions > 0 ? ((categorizedCount / totalTransactions) * 100).toFixed(1) : 0;
  const validationSummary = getValidationSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Smart Bank Statement Processor
          </h1>
          <p className="text-gray-600 text-lg">
            Advanced PDF processing with intelligent document validation and pattern recognition
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

        {/* Upload Section with Validation */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="text-center">
            <Upload className="mx-auto h-16 w-16 text-blue-500 mb-4" />
            <h3 className="text-2xl font-medium text-gray-900 mb-2">
              Upload Bank Statements
            </h3>
            <p className="text-gray-600 mb-6">
              PDF and text files supported - Intelligent validation ensures document quality
            </p>
            
            {/* Document Validation Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center mb-3">
                <Shield className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-800 font-medium">Smart Document Validation</span>
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <div>• Detects scanned vs digital documents</div>
                <div>• Validates banking content and format</div>
                <div>• Ensures optimal processing quality</div>
              </div>
            </div>
            
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
                {/* Validation Summary */}
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
                      {validationSummary.pending > 0 && (
                        <div className="flex items-center">
                          <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1" />
                          <span className="text-blue-700">{validationSummary.pending} Validating</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
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
                </div>
                  
                <div className="max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-3">
                    {files.map((file, index) => {
                      const progress = fileProgress[file.name] || { status: 'pending', progress: 0, transactions: 0 };
                      const validation = fileValidationResults[file.name] || { isValid: null, type: 'pending', message: 'Validating...' };
                      
                      return (
                        <div key={index} className={`flex items-center rounded-lg p-3 border transition-all duration-300 ${
                          validation.isValid === true ? 'bg-green-50 border-green-200' :
                          validation.isValid === false ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200'
                        }`}>
                          {/* File Icon and Info */}
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
                                  
                                  {/* Validation Status Badge */}
                                  {validation.isValid === true && (
                                    <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                      <ThumbsUp className="h-3 w-3 mr-1" />
                                      Valid
                                    </div>
                                  )}
                                  {validation.isValid === false && (
                                    <div className="flex items-center bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      {validation.type === 'scanned' ? 'Scanned' : 
                                       validation.type === 'wrong_document' ? 'Wrong Doc' : 'Invalid'}
                                    </div>
                                  )}
                                  {validation.isValid === null && (
                                    <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                      <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse mr-1" />
                                      Checking...
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Validation Message */}
                              <div className="mt-1 text-xs text-gray-600">
                                {validation.message}
                              </div>
                              
                              {/* Progress Bar for Individual File */}
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
                              
                              {/* Validation Details (for failed validation) */}
                              {validation.isValid === false && validation.suggestion && (
                                <div className="mt-2 p-2 bg-white border border-red-200 rounded text-xs">
                                  <div className="text-red-700 font-medium mb-1">Suggestion:</div>
                                  <div className="text-red-600">{validation.suggestion}</div>
                                </div>
                              )}
                              
                              {/* Processing Error Message */}
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

        {/* Process Button */}
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
          
          {files.length > 0 && !canProcess() && (
            <p className="text-sm text-red-600 mt-2">
              No valid files to process. Please upload valid bank statement documents.
            </p>
          )}
          
          {canProcess() && !processing && (
            <p className="text-sm text-gray-500 mt-2">
              Ready to process {validationSummary.valid} validated file{validationSummary.valid !== 1 ? 's' : ''} • 
              {validationSummary.invalid > 0 && `${validationSummary.invalid} invalid file${validationSummary.invalid !== 1 ? 's' : ''} will be skipped`}
            </p>
          )}
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

            {/* Uncategorized Transactions */}
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
              <h4 className="font-medium text-green-700 mb-2">Smart Document Validation</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Detects scanned vs digital PDFs</li>
                <li>• Validates banking content automatically</li>
                <li>• User-friendly feedback with thumbs up</li>
                <li>• Prevents processing of invalid documents</li>
              </ul>
            </div>
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
              <h4 className="font-medium text-green-700 mb-2">Professional Reporting</h4>
              <ul className="text-sm text-green-600 space-y-1">
                <li>• Category analysis sheet</li>
                <li>• Statistical summaries</li>
                <li>• Validation status tracking</li>
                <li>• Better Excel formatting</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-6 border-t">
          <p className="text-gray-600 text-sm">
            Smart Bank Statement Processor v8.0 - With Intelligent Document Validation & User-Friendly Feedback
          </p>
        </div>
      </div>
    </div>
  );
};

export default BankStatementProcessor;
