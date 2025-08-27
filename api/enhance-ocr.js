import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';

const BankStatementProcessor = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);

  const logMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp} ${message}`]);
  };

  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setFiles(uploadedFiles);
    setLogs([]);
    setResults(null);
    logMessage(`${uploadedFiles.length} file(s) uploaded successfully`);
  };

  const categorizeTransaction = (description) => {
    const rules = {
      'SALES': ['ATM Cash Deposit', 'Cash Deposit', 'Deposit', 'Credit Transfer', 'Incoming'],
      'BANK CHARGES': ['Banking Fee', 'Service Fee', 'Banking Subs Fee', 'Account Fee', 'Monthly Fee'],
      'UTILITIES': ['Electricity', 'Water', 'Internet', 'Phone', 'Mobile'],
      'Salary': ['Salary', 'Cash Cheque', 'Payroll', 'Wages'],
      'RENT': ['Rent', 'Property', 'Lease'],
      'GROCERIES': ['Supermarket', 'Grocery', 'Food'],
      'FUEL': ['Petrol', 'Diesel', 'Gas Station', 'Fuel'],
      'INSURANCE': ['Insurance', 'Policy', 'Premium'],
      'CSG': ['Direct Debit Scheme', 'CSG', 'Social Security'],
      'PRGF': ['Interbank Transfer', 'Bank Transfer', 'Wire Transfer'],
      'SCHEME (PRIME)': ['JuicePro Transfer', 'Prime', 'Scheme'],
      'MISCELLANEOUS': ['Refill', 'VAT', 'Merchant', 'Payment', 'Transfer']
    };

    const desc = description.toLowerCase();
    for (const [category, keywords] of Object.entries(rules)) {
      for (const keyword of keywords) {
        if (desc.includes(keyword.toLowerCase())) {
          return { category, keyword };
        }
      }
    }
    return { category: 'UNCATEGORIZED', keyword: '' };
  };

  const extractTransactionsFromText = (text, filename) => {
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    logMessage(`Analyzing ${lines.length} lines from ${filename}...`);
    
    const meaningfulLines = lines.filter(line => {
      const hasNumbers = /\d/.test(line);
      const hasLetters = /[a-zA-Z]/.test(line);
      const isNotHeader = !line.toLowerCase().includes('statement') && 
                         !line.toLowerCase().includes('account number') &&
                         !line.toLowerCase().includes('currency');
      return hasNumbers && hasLetters && isNotHeader;
    });
    
    logMessage(`${meaningfulLines.length} substantial lines to process`);
    
    const transactions = [];
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/;
    
    meaningfulLines.forEach((line, index) => {
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        logMessage(`Date found: "${line.substring(0, 80)}..."`);
        
        const transaction = {
          date: dateMatch[1],
          description: line.replace(dateMatch[0], '').trim(),
          amount: index + 1, // Placeholder - will be enhanced by Claude
          sourceFile: filename
        };
        
        const categorization = categorizeTransaction(transaction.description);
        transaction.category = categorization.category;
        transaction.matchedKeyword = categorization.keyword;
        
        transactions.push(transaction);
      }
    });
    
    logMessage(`Summary: ${meaningfulLines.filter(line => datePattern.test(line)).length} date lines, ${transactions.length} valid transactions`);
    return transactions;
  };

  const processFile = async (file) => {
    logMessage(`Processing ${file.name}...`);

    try {
      // Load PDF.js dynamically
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
      
      const pdfjsLib = window.pdfjsLib;

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      logMessage(`Reading PDF: ${file.name}...`);

      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      logMessage(`PDF loaded: ${pdf.numPages} pages found`);

      let allText = '';

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        allText += pageText + '\n';
        logMessage(`Page ${pageNum} text extracted - ${pageText.length} chars`);
      }

      // Check if we need OCR
      const meaningfulLines = allText.split('\n').filter(line => 
        line.trim().length > 5 && /[a-zA-Z]/.test(line) && /\d/.test(line)
      ).length;

      logMessage(`Meaningful text lines found: ${meaningfulLines}`);

      let finalText = allText;

      // If low text content, use OCR
      if (meaningfulLines < 20) {
        logMessage('Low text content detected - switching to OCR mode...');

        // Load Tesseract.js dynamically
        if (!window.Tesseract) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
          document.head.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = () => resolve();
          });
        }
        
        const { createWorker } = window.Tesseract;
        const worker = await createWorker('eng');

        let ocrText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          logMessage(`Converting page ${pageNum} to image for OCR...`);
          
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport }).promise;
          
          logMessage(`Running OCR on page ${pageNum}...`);

          // Enhanced OCR settings for financial documents
          await worker.setParameters({
            'tessedit_char_whitelist': '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/-:()\' ',
            'preserve_interword_spaces': '1',
            'tessedit_pageseg_mode': '6',
          });

          const ocrResult = await worker.recognize(canvas, {
            logger: m => {
              if (m.status === 'recognizing text') {
                logMessage(`OCR Progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          });
          
          ocrText += ocrResult.data.text + '\n';
          logMessage(`OCR completed for page ${pageNum} - ${ocrResult.data.text.length} chars extracted`);
        }

        await worker.terminate();
        finalText = ocrText;
      }

      logMessage(`Text extraction complete - ${finalText.length} total characters`);

      // Extract initial transactions using our basic method
      let transactions = extractTransactionsFromText(finalText, file.name);
      logMessage(`Initial: ${transactions.length} transactions from ${file.name}`);

      // Enhance with Claude API
      logMessage('Enhancing OCR data with Claude API...');

      try {
        const response = await fetch('/api/enhance-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ocrText: finalText })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Try to parse Claude's response
          try {
            let cleanedData = result.enhancedData;
            
            // Remove any markdown formatting if present
            if (cleanedData.includes('```')) {
              cleanedData = cleanedData.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }
            
            const cleanedTransactions = JSON.parse(cleanedData);
            
            logMessage(`Claude enhanced ${cleanedTransactions.length} transactions`);
            
            // Convert Claude's format to our format
            transactions = cleanedTransactions.map((t, index) => {
              const categorization = categorizeTransaction(t.description || '');
              return {
                date: t.date,
                description: t.description,
                amount: Math.abs(parseFloat(t.amount) || 0),
                sourceFile: file.name,
                category: categorization.category,
                matchedKeyword: categorization.keyword,
                confidence: 'claude-enhanced',
                type: t.type
              };
            });
            
          } catch (parseError) {
            logMessage('Claude response parsing failed, using original OCR...');
          }
        } else {
          throw new Error('API call failed');
        }
        
      } catch (error) {
        logMessage('Claude API failed, using original OCR...');
        // Keep original transactions
      }

      logMessage(`Final: ${transactions.length} transactions from ${file.name}`);

      // Show categorization results
      transactions.forEach(transaction => {
        if (transaction.category !== 'UNCATEGORIZED') {
          logMessage(`${transaction.description.substring(0, 30)}... → ${transaction.category}`);
        } else {
          logMessage(`Uncategorized: ${transaction.description.substring(0, 30)}...`);
        }
      });

      return transactions;

    } catch (error) {
      logMessage(`Error processing ${file.name}: ${error.message}`);
      return [];
    }
  };

  const processBulkFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setLogs([]);
    logMessage('Starting enhanced processing with OCR support...');

    let allTransactions = [];

    for (const file of files) {
      const transactions = await processFile(file);
      allTransactions = [...allTransactions, ...transactions];
    }

    const categorized = allTransactions.filter(t => t.category && t.category !== 'UNCATEGORIZED').length;
    const uncategorized = allTransactions.filter(t => !t.category || t.category === 'UNCATEGORIZED').length;

    setResults({
      total: allTransactions.length,
      categorized,
      uncategorized,
      successRate: allTransactions.length > 0 ? ((categorized / allTransactions.length) * 100).toFixed(1) : 0
    });

    logMessage('Processing complete!');
    logMessage(`Total: ${allTransactions.length}, Categorized: ${categorized}, Uncategorized: ${uncategorized}`);
    logMessage(`Success Rate: ${results?.successRate || 0}%`);

    // Generate Excel report
    generateReport(allTransactions, files);

    setIsProcessing(false);
  };

  const generateReport = (allTransactions, allFiles) => {
    // Load XLSX library dynamically
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
      
      // Sheet 1: Summary Report
      const summaryData = [
        ['BANK STATEMENT PROCESSING REPORT'],
        ['Generated:', timestamp],
        ['Files Processed:', allFiles.length],
        [''],
        ['SUMMARY BY CATEGORY'],
        ['Category', 'Count', 'Total Amount (MUR)'],
      ];
      
      // Calculate category totals
      const categoryTotals = {};
      allTransactions.forEach(t => {
        const cat = t.category || 'UNCATEGORIZED';
        if (!categoryTotals[cat]) {
          categoryTotals[cat] = { count: 0, total: 0 };
        }
        categoryTotals[cat].count++;
        categoryTotals[cat].total += parseFloat(t.amount) || 0;
      });
      
      Object.entries(categoryTotals).forEach(([category, data]) => {
        summaryData.push([category, data.count, data.total.toFixed(2)]);
      });
      
      summaryData.push(['']);
      summaryData.push(['OVERALL STATISTICS']);
      summaryData.push(['Total Transactions:', allTransactions.length]);
      summaryData.push(['Categorized:', allTransactions.filter(t => t.category && t.category !== 'UNCATEGORIZED').length]);
      summaryData.push(['Uncategorized:', allTransactions.filter(t => !t.category || t.category === 'UNCATEGORIZED').length]);
      summaryData.push(['Success Rate:', `${((allTransactions.filter(t => t.category && t.category !== 'UNCATEGORIZED').length / allTransactions.length) * 100).toFixed(1)}%`]);
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
      
      // Sheet 2: All Transactions (Professional Format)
      const transactionData = [
        ['Date', 'Reference', 'Description', 'Amount (MUR)', 'Type', 'Category', 'Source File', 'Status']
      ];
      
      allTransactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        const type = amount >= 0 ? 'Credit' : 'Debit';
        const status = (transaction.category && transaction.category !== 'UNCATEGORIZED') ? 'Categorized' : 'Uncategorized';
        
        transactionData.push([
          transaction.date,
          transaction.reference || '',
          transaction.description,
          Math.abs(amount).toFixed(2),
          type,
          transaction.category || 'UNCATEGORIZED',
          transaction.sourceFile,
          status
        ]);
      });
      
      const transactionWS = XLSX.utils.aoa_to_sheet(transactionData);
      
      // Set column widths for better formatting
      transactionWS['!cols'] = [
        { wch: 12 }, // Date
        { wch: 15 }, // Reference
        { wch: 40 }, // Description
        { wch: 15 }, // Amount
        { wch: 10 }, // Type
        { wch: 20 }, // Category
        { wch: 25 }, // Source File
        { wch: 12 }  // Status
      ];
      
      XLSX.utils.book_append_sheet(wb, transactionWS, "All Transactions");
      
      // Sheet 3: Uncategorized Items (for manual review)
      const uncategorized = allTransactions.filter(t => !t.category || t.category === 'UNCATEGORIZED');
      if (uncategorized.length > 0) {
        const uncategorizedData = [
          ['Date', 'Description', 'Amount (MUR)', 'Source File', 'Suggested Category']
        ];
        
        uncategorized.forEach(transaction => {
          uncategorizedData.push([
            transaction.date,
            transaction.description,
            transaction.amount,
            transaction.sourceFile,
            '' // Empty column for manual categorization
          ]);
        });
        
        const uncategorizedWS = XLSX.utils.aoa_to_sheet(uncategorizedData);
        uncategorizedWS['!cols'] = [
          { wch: 12 }, // Date
          { wch: 50 }, // Description
          { wch: 15 }, // Amount
          { wch: 25 }, // Source File
          { wch: 20 }  // Suggested Category
        ];
        
        XLSX.utils.book_append_sheet(wb, uncategorizedWS, "Uncategorized");
      }
      
      // Generate and download Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Statements_Report_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      logMessage('Professional Excel report downloaded!');
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Bank Statement Processor Pro
        </h1>
        <p className="text-gray-600">
          Advanced OCR + AI-powered bank statement processing with Claude enhancement
        </p>
      </div>

      {/* File Upload */}
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="flex justify-center">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                Upload Bank Statement PDFs
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                multiple
                accept=".pdf"
                className="sr-only"
                onChange={handleFileUpload}
              />
              <span className="mt-1 block text-sm text-gray-500">
                Supports multiple PDF files, including scanned documents
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">Selected Files:</h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center text-blue-800">
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-sm">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Process Button */}
      <div className="text-center mb-6">
        <button
          onClick={processBulkFiles}
          disabled={files.length === 0 || isProcessing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-8 rounded-lg transition-colors"
        >
          {isProcessing ? 'Processing with AI Enhancement...' : 'Process Bank Statements'}
        </button>
      </div>

      {/* Results Summary */}
      {results && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-800">{results.total}</div>
            <div className="text-blue-600">Total Transactions</div>
          </div>
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-800">{results.categorized}</div>
            <div className="text-green-600">Categorized</div>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-800">{results.uncategorized}</div>
            <div className="text-yellow-600">Uncategorized</div>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-800">{results.successRate}%</div>
            <div className="text-purple-600">Success Rate</div>
          </div>
        </div>
      )}

      {/* Processing Logs */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
        <h3 className="text-white mb-2">Processing Logs:</h3>
        {logs.length === 0 ? (
          <div className="text-gray-500">Ready to process bank statements...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))
        )}
      </div>
    </div>
  );
};

export default BankStatementProcessor;
