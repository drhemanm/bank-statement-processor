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
  const [apiStatus, setApiStatus] = useState('unknown');

  // MCB-specific categorization mapping based on your Excel mapping
  const categoryMapping = {
    'CSG/PRGF': {
      keywords: ['direct debit scheme', 'mauritius revenue authority'],
      patterns: [/direct\s+debit\s+scheme.*mauritius\s+revenue\s+authority/i]
    },
    'Prime (Scheme)': {
      keywords: ['interbank transfer', 'mauritius revenue authority', 'paer'],
      patterns: [/interbank\s+transfer.*mauritius\s+revenue\s+authority.*paer/i]
    },
    'Consultancy Fee': {
      keywords: ['standing order', 'consultancy fee', 'yazak services'],
      patterns: [/standing\s+order.*consultancy\s+fee.*yazak\s+services/i]
    },
    'Salary': {
      keywords: ['juicepro transfer', 'miss wadashah sahaboolea'],
      patterns: [/juicepro\s+transfer.*miss\s+wadashah\s+sahaboolea/i]
    },
    'Purchase/Payment/Expense': {
      keywords: ['juicepro transfer', 'pastry pro ltd', 'merchant instant payment', 'juice payment'],
      patterns: [
        /juicepro\s+transfer.*pastry\s+pro\s+ltd/i,
        /merchant\s+instant\s+payment/i,
        /juice\s+payment/i
      ]
    },
    'Sales': {
      keywords: ['juice account transfer', 'account transfer', 'eoy24bcashback'],
      patterns: [
        /juice\s+account\s+transfer/i,
        /account\s+transfer.*eoy24bcashback/i
      ]
    },
    'Cash withdrawal': {
      keywords: ['atm cash withdrawal'],
      patterns: [/atm\s+cash\s+withdrawal/i]
    },
    'Cash Deposit': {
      keywords: ['atm cash deposit', 'cash deposit'],
      patterns: [/atm\s+cash\s+deposit/i, /cash\s+deposit/i]
    },
    'Bank Charges': {
      keywords: ['business banking subs fee', 'refill amount', 'vat on refill'],
      patterns: [
        /business\s+banking\s+subs\s+fee/i,
        /refill\s+amount/i,
        /vat\s+on\s+refill/i
      ]
    },
    'Transfer': {
      keywords: ['interbank transfer', 'juicepro transfer', 'cash cheque'],
      patterns: [
        /interbank\s+transfer/i,
        /juicepro\s+transfer/i,
        /cash\s+cheque/i
      ]
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
    setLogs(prev => [logEntry, ...prev.slice(0, 49)]);
    
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
      const isValidSize = file.size <= 50 * 1024 * 1024;
      
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
    setLogs(prev => prev.slice(0, 5));
  };

  // ENHANCED OCR function with Claude AI integration
  const enhanceOCRWithClaude = async (ocrText, imageData = null, isImage = false, pageNumber = 1) => {
    if (!aiEnhancementEnabled) {
      addLog(`Page ${pageNumber}: AI enhancement disabled, using direct extraction`, 'info');
      return ocrText;
    }

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
      return ocrText;
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
              const canvas = document.createElement('canvas');
              const canvasContext = canvas.getContext('2d');
              const viewport = page.getViewport({ scale: 2.0 });
              
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              await page.render({
                canvasContext: canvasContext,
                viewport: viewport
              }).promise;
              
              const imageData = canvas.toDataURL('image/png').split(',')[1];
              
              if (aiEnhancementEnabled) {
                try {
                  pageText = await enhanceOCRWithClaude(null, imageData, true, pageNum);
                  extractionMethod = 'ai-vision';
                  addLog(`Page ${pageNum}: AI vision OCR completed`, 'success');
                } catch (aiError) {
                  addLog(`Page ${pageNum}: AI vision failed, trying Tesseract`, 'warning');
                }
              }
              
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

  // MCB-specific metadata extraction
  const extractStatementMetadata = async (text, fileName) => {
    const metadata = {
      fileName: fileName,
      accountNumber: null,
      iban: null,
      statementPeriod: null,
      currency: 'MUR',
      openingBalance: 0,
      closingBalance: 0,
      bankName: 'Mauritius Commercial Bank',
      accountType: 'Current Account'
    };

    addLog(`DEBUG: Looking for balances in text of length ${text.length}`, 'info');

    // MCB-specific extraction patterns - FIXED
    const patterns = {
      accountNumber: [
        /Account\s+Number\s*:\s*(\d+)/i,
        /(\d{12})/
      ],
      iban: [
        /IBAN:\s*(MU\d{2}[A-Z0-9]+)/i
      ],
      statementPeriod: [
        /From\s+(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i
      ],
      openingBalance: [
        /Opening\s+Balance\s+([\d,]+\.?\d*)/i,
        /Balance\s+([\d,]+\.?\d*)/i  // More flexible pattern
      ],
      closingBalance: [
        /Closing\s+Balance\s+([\d,]+\.?\d*)/i,
        /(?:Closing|Final)\s+Balance\s+([\d,]+\.?\d*)/i
      ]
    };

    // Extract each field
    Object.entries(patterns).forEach(([field, fieldPatterns]) => {
      for (const pattern of fieldPatterns) {
        const match = text.match(pattern);
        if (match) {
          switch (field) {
            case 'accountNumber':
              metadata[field] = match[1];
              addLog(`Found account number: ${match[1]}`, 'info');
              break;
            case 'iban':
              metadata[field] = match[1];
              addLog(`Found IBAN: ${match[1]}`, 'info');
              break;
            case 'statementPeriod':
              if (match[2]) {
                metadata[field] = `${match[1]} to ${match[2]}`;
                addLog(`Found period: ${match[1]} to ${match[2]}`, 'info');
              }
              break;
            case 'openingBalance':
            case 'closingBalance':
              metadata[field] = parseFloat(match[1].replace(/,/g, '')) || 0;
              addLog(`Found ${field}: ${match[1]} (parsed as ${metadata[field]})`, 'info');
              break;
          }
          break;
        }
      }
    });

    // If we didn't find opening/closing balance, look for specific MCB patterns
    if (metadata.openingBalance === 0) {
      // Look for "Opening Balance 7,096.39" pattern specifically
      const openingMatch = text.match(/Opening\s+Balance\s+([\d,]+\.?\d*)/i);
      if (openingMatch) {
        metadata.openingBalance = parseFloat(openingMatch[1].replace(/,/g, '')) || 0;
        addLog(`Found opening balance via specific pattern: ${openingMatch[1]}`, 'success');
      } else {
        addLog(`DEBUG: Could not find opening balance. Sample text: ${text.substring(0, 500)}...`, 'warning');
      }
    }

    if (metadata.closingBalance === 0) {
      // Look for "Closing Balance 105,373.39" pattern specifically  
      const closingMatch = text.match(/Closing\s+Balance\s+([\d,]+\.?\d*)/i);
      if (closingMatch) {
        metadata.closingBalance = parseFloat(closingMatch[1].replace(/,/g, '')) || 0;
        addLog(`Found closing balance via specific pattern: ${closingMatch[1]}`, 'success');
      } else {
        addLog(`DEBUG: Could not find closing balance. Looking for last balance in transactions...`, 'warning');
        // Try to find the last balance mentioned in the text
        const balanceMatches = text.match(/Balance\s+([\d,]+\.?\d*)/gi);
        if (balanceMatches && balanceMatches.length > 0) {
          const lastBalance = balanceMatches[balanceMatches.length - 1];
          const balanceValue = parseFloat(lastBalance.match(/([\d,]+\.?\d*)/)[1].replace(/,/g, ''));
          metadata.closingBalance = balanceValue;
          addLog(`Using last balance found as closing balance: ${balanceValue}`, 'info');
        }
      }
    }

    addLog(`Extracted metadata: Opening Balance MUR ${metadata.openingBalance.toLocaleString()}, Closing Balance MUR ${metadata.closingBalance.toLocaleString()}`, 'success');
    return metadata;
  };

  // MCB-specific transaction extraction - FIXED PATTERNS
  const extractTransactions = async (text, fileName) => {
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim());

    addLog(`DEBUG: Starting transaction extraction from ${lines.length} lines`, 'info');
    
    let transactionCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || 
          line.includes('TRANS DATE') || 
          line.includes('TRANSACTION DETAILS') ||
          line.includes('BALANCE') || 
          line.includes('Current Account') ||
          line.includes('Page :') ||
          line.includes('MCB') ||
          line.length < 20) {
        continue;
      }

      // MCB transaction patterns - more flexible matching
      // Pattern 1: DD/MM/YYYY DD/MM/YYYY Description Amount Balance (most common)
      let match = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([\d,]+\.?\d{2})\s+([\d,]+\.?\d{2})$/);
      
      if (!match) {
        // Pattern 2: DD/MM/YYYY DD/MM/YYYY Description DEBIT_AMT CREDIT_AMT BALANCE
        match = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([\d,]+\.?\d{2})?\s*([\d,]+\.?\d{2})\s+([\d,]+\.?\d{2})$/);
        
        if (match) {
          // Adjust for debit/credit format
          const [, transactionDate, valueDate, description, possibleDebit, possibleCredit, balance] = match;
          
          // Determine if possibleCredit is actually the amount and balance
          let debitAmount = 0, creditAmount = 0, balanceAmount = 0;
          
          if (possibleDebit && possibleCredit && balance) {
            // Format: DATE DATE DESC DEBIT CREDIT BALANCE
            debitAmount = parseFloat(possibleDebit.replace(/,/g, '')) || 0;
            creditAmount = parseFloat(possibleCredit.replace(/,/g, '')) || 0;
            balanceAmount = parseFloat(balance.replace(/,/g, '')) || 0;
          } else {
            // Format: DATE DATE DESC AMOUNT BALANCE
            debitAmount = 0;
            creditAmount = parseFloat(possibleCredit.replace(/,/g, '')) || 0;
            balanceAmount = parseFloat(balance.replace(/,/g, '')) || 0;
          }
          
          const amount = Math.max(debitAmount, creditAmount);
          const isDebit = debitAmount > creditAmount;
          
          if (amount > 0) {
            transactionCounter++;
            const transaction = {
              transactionDate: transactionDate,
              valueDate: valueDate,
              description: description.trim(),
              amount,
              balance: balanceAmount,
              isDebit,
              sourceFile: fileName,
              transactionId: `${fileName}_${transactionCounter}`,
              rawLine: line
            };
            
            transactions.push(transaction);
            addLog(`Found transaction ${transactionCounter}: ${description.substring(0, 30)}... MUR ${amount.toLocaleString()}`, 'info');
          }
        }
      } else {
        // Pattern 1 matched
        const [, transactionDate, valueDate, description, amount, balance] = match;
        
        const amountValue = parseFloat(amount.replace(/,/g, '')) || 0;
        const balanceValue = parseFloat(balance.replace(/,/g, '')) || 0;
        
        if (amountValue > 0) {
          transactionCounter++;
          
          // Determine if it's debit or credit by looking at balance change
          // This is a simple heuristic - you might need to adjust based on your data
          const isDebit = description.toLowerCase().includes('withdrawal') || 
                          description.toLowerCase().includes('charge') ||
                          description.toLowerCase().includes('fee') ||
                          description.toLowerCase().includes('payment to');
          
          const transaction = {
            transactionDate: transactionDate,
            valueDate: valueDate,
            description: description.trim(),
            amount: amountValue,
            balance: balanceValue,
            isDebit,
            sourceFile: fileName,
            transactionId: `${fileName}_${transactionCounter}`,
            rawLine: line
          };
          
          transactions.push(transaction);
          addLog(`Found transaction ${transactionCounter}: ${description.substring(0, 30)}... MUR ${amountValue.toLocaleString()}`, 'info');
        }
      }
    }

    addLog(`Extracted ${transactions.length} transactions from ${fileName}`, transactions.length > 0 ? 'success' : 'warning');
    
    if (transactions.length === 0) {
      // Debug: Show some sample lines to understand the format
      addLog(`DEBUG: Sample lines from ${fileName}:`, 'warning');
      lines.slice(0, 10).forEach((line, index) => {
        if (line.trim() && line.includes('/')) {
          addLog(`Line ${index}: ${line}`, 'warning');
        }
      });
    }
    
    return transactions;
  };

  // Enhanced categorization with MCB-specific patterns
  const categorizeTransaction = (transaction) => {
    const description = transaction.description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [category, config] of Object.entries(categoryMapping)) {
      let score = 0;
      let matchedItem = null;
      
      // Check exact keyword matches
      for (const keyword of config.keywords) {
        if (description.includes(keyword.toLowerCase())) {
          score += 3;
          matchedItem = keyword;
          break;
        }
      }
      
      // Check pattern matches
      if (config.patterns) {
        for (const pattern of config.patterns) {
          if (pattern.test(description)) {
            score += 2;
            if (!matchedItem) matchedItem = pattern.toString();
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          category,
          matchedKeyword: matchedItem,
          confidence: Math.min(score / 3, 1.0)
        };
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 0.6) {
      return bestMatch;
    }
    
    return null;
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
      addLog(`AI Enhancement: ${aiEnhancementEnabled ? 'Enabled' : 'Disabled'}`, 'info');
      
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        
        try {
          addLog(`Processing file ${fileIndex + 1}/${files.length}: ${file.name}`, 'info');
          
          // Extract text from PDF
          const extractionResult = await processPDF(file);
          const extractedText = extractionResult.text;
          
          // Extract metadata
          addLog(`Extracting metadata from ${file.name}...`, 'info');
          const metadata = await extractStatementMetadata(extractedText, file.name);
          newStatementMetadata[file.name] = metadata;
          
          // Extract transactions
          addLog(`Extracting transactions from ${file.name}...`, 'info');
          const transactions = await extractTransactions(extractedText, file.name);
          
          if (transactions.length === 0) {
            addLog(`No transactions found in ${file.name}. This might indicate a parsing issue.`, 'warning');
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
          
          addLog(`Extracted ${transactions.length} transactions from ${file.name}`, 'success');
          
          // Categorize transactions
          addLog(`Categorizing transactions from ${file.name}...`, 'info');
          let categorized = 0;
          let uncategorized = 0;
          
          for (const transaction of transactions) {
            const categoryResult = categorizeTransaction(transaction);
            
            if (categoryResult) {
              transaction.category = categoryResult.category;
              transaction.matchedKeyword = categoryResult.matchedKeyword;
              transaction.confidence = categoryResult.confidence;
              
              newResults[categoryResult.category].push(transaction);
              categorized++;
            } else {
              transaction.category = 'Uncategorized';
              transaction.reason = 'No matching pattern found';
              newUncategorized.push(transaction);
              uncategorized++;
            }
          }
          
          newFileStats[file.name] = {
            status: 'success',
            total: transactions.length,
            categorized: categorized,
            uncategorized: uncategorized,
            successRate: transactions.length > 0 ? ((categorized / transactions.length) * 100).toFixed(1) : 0,
            extractionDetails: extractionResult.pageDetails,
            metadata: metadata
          };

          newCounters[file.name] = { processed: transactions.length };
          
          addLog(`${file.name}: ${categorized} categorized, ${uncategorized} uncategorized`, 'success');
          
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

      // Update state with all results
      setResults(newResults);
      setUncategorizedData(newUncategorized);
      setFileStats(newFileStats);
      setStatementMetadata(newStatementMetadata);
      setDocumentCounters(newCounters);

      const totalTransactions = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0) + newUncategorized.length;
      const totalCategorized = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0);
      const successRate = totalTransactions > 0 ? ((totalCategorized / totalTransactions) * 100).toFixed(1) : 0;
      
      addLog(`Processing complete!`, 'success');
      addLog(`Summary: ${totalTransactions} total transactions, ${totalCategorized} categorized (${successRate}%)`, 'success');
      
      if (newUncategorized.length > 0) {
        addLog(`${newUncategorized.length} transactions need manual review`, 'warning');
      }
      
    } catch (error) {
      addLog(`Processing failed: ${error.message}`, 'error');
      console.error('Processing error:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Enhanced export with category-based sheets
  const handleExportWithGrouping = async (groupingConfig) => {
    if (!results || Object.keys(results).length === 0) {
      addLog('No data to export', 'error');
      return;
    }

    try {
      setProcessing(true);
      addLog('Starting Excel export with category sheets...', 'info');
      
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
      
      addLog('Excel export completed successfully!', 'success');
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
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="relative">
              <FileText className="h-8 w-8 text-blue-600" />
              {apiStatus === 'working' && (
                <Zap className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">MCB Bank Statement Processor</h1>
          </div>
          <p className="text-lg text-gray-600">
            Advanced MCB transaction categorization with Claude AI enhancement
          </p>
          
          {/* API Status */}
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

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Upload MCB Bank Statements</h2>
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
                    Select one or more MCB PDF bank statement files (up to 50MB each)
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Files Display */}
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
                    <div className="text-sm text-gray-600">Single Excel file with category-based sheets</div>
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

            {/* Process Button */}
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
                    <span>Process MCB Statements</span>
                    {aiEnhancementEnabled && <Zap className="h-4 w-4" />}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Processing Logs */}
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
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border-2 border-blue-200 p-4 flex items-center space-x-3 min-w-0 max-w-sm">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-gray-800 font-medium">Processing MCB statements...</div>
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
