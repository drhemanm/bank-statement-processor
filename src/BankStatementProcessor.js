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

  // FIXED Content analysis function with proper thresholds
  const analyzeDocumentContent = (text, fileName, totalPages) => {
    const textLength = text.length;
    const meaningfulLines = text.split('\n').filter(line => 
      line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
    ).length;

    addLog(`Analyzing document content: ${textLength} characters, ${meaningfulLines} meaningful lines`, 'info');

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

    const bankingKeywordMatches = bankingKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    const currencyMatches = currencyPatterns.filter(pattern => 
      text.toLowerCase().includes(pattern.toLowerCase())
    ).length;
    
    const dateMatches = (text.match(datePatterns) || []).length;
    const amountMatches = (text.match(amountPatterns) || []).length;

    const textDensity = textLength / totalPages;
    const avgMeaningfulLinesPerPage = meaningfulLines / totalPages;
    
    const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, '')).size;
    const charVariety = uniqueChars / Math.min(textLength, 100);

    addLog(`Analysis results - Banking terms: ${bankingKeywordMatches}, Currency: ${currencyMatches}, Dates: ${dateMatches}, Amounts: ${amountMatches}`, 'info');
    addLog(`Text density: ${textDensity.toFixed(1)} chars/page, Line density: ${avgMeaningfulLinesPerPage.toFixed(1)} lines/page`, 'info');

    const strongBankingIndicators = bankingKeywordMatches >= 5 && dateMatches >= 3 && currencyMatches >= 1;
    const hasTransactionData = text.toLowerCase().includes('transaction') && dateMatches >= 3;
    
    // 1. WRONG DOCUMENT TYPE DETECTION
    if (!strongBankingIndicators && bankingKeywordMatches < 3 && currencyMatches === 0 && dateMatches < 3) {
      const detectedContent = [];
      
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
        message: `This does not appear to be a bank statement${detectedType}`,
        suggestion: 'Please upload a bank statement document. Expected content includes account details, transaction dates, amounts with currency, and balance information.',
        details: {
          bankingKeywords: bankingKeywordMatches,
          currencyMatches,
          dateMatches,
          detectedContent
        }
      };
    }

    // 2. SCANNED DOCUMENT DETECTION - MUCH MORE CONSERVATIVE
    const veryLowTextDensity = textDensity < 50;
    const extremelyLowLines = avgMeaningfulLinesPerPage < 2;
    const veryPoorCharVariety = charVariety < 0.15;
    
    const containsOcrErrors = /[|]{2,}|_{3,}|\.{5,}/.test(text);
    const hasGarbledText = text.match(/\b[a-zA-Z]{1,2}\b/g)?.length > textLength * 0.1;
    
    if ((veryLowTextDensity || extremelyLowLines || veryPoorCharVariety) && 
        !strongBankingIndicators && 
        (containsOcrErrors || hasGarbledText)) {
      return {
        isValid: false,
        type: 'scanned',
        confidence: veryLowTextDensity ? 'high' : 'medium',
        message: 'Scanned document detected - contains mostly images',
        suggestion: 'This appears to be a scanned PDF with images instead of searchable text. For best results, please request a digital/text-based statement from your bank, or consider our premium OCR service for image processing.',
        details: {
          textDensity: Math.round(textDensity),
          meaningfulLines,
          avgLinesPerPage: Math.round(avgMeaningfulLinesPerPage * 10) / 10,
          charVariety: Math.round(charVariety * 100) / 100
        }
      };
    }
    
    // 3. LOW QUALITY DETECTION
    if (avgMeaningfulLinesPerPage < 1 || textDensity < 25) {
      return {
        isValid: false,
        type: 'low_quality',
        confidence: 'medium',
        message: 'Low quality document or insufficient content detected',
        suggestion: 'This document may be corrupted, have low text quality, or contain insufficient transaction data. Please verify the document quality or try a different format.',
        details: {
          avgLinesPerPage: Math.round(avgMeaningfulLinesPerPage * 10) / 10,
          textDensity: Math.round(textDensity)
        }
      };
    }

    // 4. VALIDATION SUCCESSFUL
    let confidenceScore = 0;
    
    if (strongBankingIndicators) confidenceScore += 40;
    if (hasTransactionData) confidenceScore += 20;
    confidenceScore += Math.min(bankingKeywordMatches * 2, 20);
    confidenceScore += Math.min(dateMatches * 2, 15);
    confidenceScore += currencyMatches * 5;

    const confidenceLevel = confidenceScore > 70 ? 'high' : confidenceScore > 40 ? 'medium' : 'low';

    return {
      isValid: true,
      type: 'valid_statement',
      confidence: confidenceLevel,
      message: 'Valid bank statement detected - Ready for processing!',
      suggestion: 'Document appears to be a proper bank statement with searchable transaction data. Processing should work optimally.',
      details: {
        confidenceScore: Math.round(confidenceScore),
        bankingKeywords: bankingKeywordMatches,
        currencyMatches,
        dateMatches,
        amountMatches,
        textDensity: Math.round(textDensity),
        avgLinesPerPage: Math.round(avgMeaningfulLinesPerPage * 10) / 10,
        strongBankingContent: strongBankingIndicators,
        hasTransactionData: hasTransactionData
      }
    };
  };

  // Document validation function
  const validateDocument = async (pdf, fileName) => {
    try {
      addLog(`Validating document: ${fileName}...`, 'info');
      
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

  const validateUploadedFile = async (file) => {
    const fileName = file.name;
    
    try {
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
          addLog(`${fileName}: Valid bank statement detected! Ready for processing.`, 'success');
        } else {
          addLog(`${fileName}: ${validation.message} - ${validation.suggestion}`, 'error');
        }

      } else if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        addLog(`Validating text file: ${fileName}`, 'info');
        
        const text = await file.text();
        const sampleText = text.substring(0, 2000);
        
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
          addLog(`${fileName}: Text file validated successfully`, 'success');
        } else {
          addLog(`${fileName}: ${validation.message}`, 'error');
        }
      } else {
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

        addLog(`${fileName}: Unsupported file type`, 'error');
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

    for (const file of uploadedFiles) {
      await validateUploadedFile(file);
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
