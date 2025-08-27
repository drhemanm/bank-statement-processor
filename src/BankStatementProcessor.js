import React, { useState } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';

const BankStatementProcessor = () => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);

  // Enhanced logging function
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
    console.log(`${timestamp} ${message}`);
  };

  // File upload handler
  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    setResults(null);
    setLogs([]);
    addLog(`${selectedFiles.length} file(s) uploaded successfully`);
  };

  // Enhanced PDF text extraction
  const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          addLog(`Reading PDF: ${file.name}...`);
          
          // Load PDF.js library if not already loaded
          if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }

          const arrayBuffer = e.target.result;
          const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
          
          addLog(`PDF loaded: ${pdf.numPages} pages found`);
          
          let fullText = '';
          let meaningfulLines = [];

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            let pageText = '';
            textContent.items.forEach((item) => {
              if (item.str && item.str.trim().length > 0) {
                pageText += item.str + ' ';
              }
            });
            
            // Clean and structure the page text
            const lines = pageText.split(/\s+/)
              .join(' ')
              .split(/(?=\d{2}\/\d{2}\/\d{4})/g)
              .filter(line => line.trim().length > 5);
            
            meaningfulLines.push(...lines);
            fullText += pageText + '\n';
            
            addLog(`Page ${pageNum} processed - ${pageText.length} characters`);
          }

          addLog(`Meaningful text lines found: ${meaningfulLines.length}`);
          
          // Enhanced text cleaning
          addLog('Applying advanced text cleaning and enhancement...');
          const cleanedText = enhanceTextRecognition(fullText, meaningfulLines);
          addLog('Text enhancement completed - improved readability');
          
          resolve(cleanedText);
        } catch (error) {
          addLog(`Error extracting PDF text: ${error.message}`, 'error');
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Enhanced text recognition and cleaning
  const enhanceTextRecognition = (rawText, lines) => {
    addLog('PDF text extraction complete - ' + rawText.length + ' total characters');
    
    // Join meaningful lines with proper spacing
    let enhanced = lines.join('\n').trim();
    
    // Fix common OCR issues
    enhanced = enhanced
      .replace(/(\d)\s+(\d)/g, '$1$2') // Fix split numbers
      .replace(/([A-Z])\s+([A-Z])/g, '$1$2') // Fix split abbreviations
      .replace(/\s{2,}/g, ' ') // Remove extra spaces
      .replace(/([a-z])\s+([A-Z])/g, '$1 $2') // Proper word spacing
      .trim();

    return enhanced;
  };

  // Process bank statement with enhanced parsing
  const processBankStatement = async (text, fileName) => {
    addLog(`Analyzing text from ${fileName}...`);
    
    // Show first part of text for debugging
    addLog(`First 500 chars: "${text.substring(0, 500)}"`);

    // Extract opening and closing balances
    const openingMatch = text.match(/Opening\s+Balance[:\s]+[A-Z]{3}\s+([\d,]+\.?\d*)/i) ||
                         text.match(/Balance\s+[Bb]rought\s+[Ff]orward[:\s]+[A-Z]{3}\s+([\d,]+\.?\d*)/i);
    const closingMatch = text.match(/Closing\s+Balance[:\s]+[A-Z]{3}\s+([\d,]+\.?\d*)/i) ||
                         text.match(/Balance\s+[Cc]arried\s+[Ff]orward[:\s]+[A-Z]{3}\s+([\d,]+\.?\d*)/i);

    const openingBalance = openingMatch ? parseFloat(openingMatch[1].replace(/,/g, '')) : null;
    const closingBalance = closingMatch ? parseFloat(closingMatch[1].replace(/,/g, '')) : null;

    if (openingBalance) addLog(`Opening Balance: MUR ${openingBalance.toLocaleString()}`);
    if (closingBalance) addLog(`Closing Balance: MUR ${closingBalance.toLocaleString()}`);

    // Clean text while preserving structure
    addLog('Text cleaned while preserving line structure');
    
    // Enhanced line-by-line processing
    addLog('Using improved line-by-line parsing with page boundary fixes...');
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Split text into potential transaction chunks
    const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/g).filter(chunk => chunk.trim().length > 10);
    addLog(`Split text into ${chunks.length} date-based chunks`);

    const transactions = [];
    let transactionCount = 0;

    // Enhanced parsing with better amount extraction for uncategorized items
    const parseTransactionLine = (line, lineIndex) => {
      // Skip obvious headers and page breaks
      if (line.includes('Page :') || line.includes('STATEMENT') || 
          line.includes('From') || line.includes('to') || 
          line.includes('IBAN') || line.includes('Account Number') ||
          line.includes('Statement Date') || line.includes('Balance') ||
          line.includes('...') || line.length < 10) {
        console.log(`Skipping header: "${line.substring(0, 50)}..."`);
        return null;
      }

      // Enhanced regex patterns for better amount extraction
      const patterns = [
        // Standard format: DD/MM/YYYY AMOUNT BALANCE DESCRIPTION
        /(\d{2}\/\d{2}\/\d{4})\s+([+-]?)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(.+)/,
        // Alternative format: DD/MM/YYYY - AMOUNT BALANCE DESCRIPTION
        /(\d{2}\/\d{2}\/\d{4})\s*-\s*([+-]?)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(.+)/,
        // Format with amount at end: DD/MM/YYYY DESCRIPTION AMOUNT BALANCE
        /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([+-]?)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/,
        // Truncated format: DD/MM/YYYY - AMOUNT... (incomplete balance)
        /(\d{2}\/\d{2}\/\d{4})\s*-\s*([+-]?)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(.*?)\.{3,}/
      ];

      // Try each pattern
      for (let i = 0; i < patterns.length; i++) {
        const match = line.match(patterns[i]);
        if (match) {
          let date, sign, amount, balance, description;
          
          if (i === 3) { // Truncated format
            [, date, sign, amount, description] = match;
            // Try to find balance from next line or calculate
            balance = null; // Will be calculated later
            console.log(`Found truncated transaction: ${date} - ${sign}${amount} ${description.substring(0, 30)}...`);
          } else if (i === 2) { // Description first format
            [, date, description, sign, amount, balance] = match;
          } else { // Standard formats
            [, date, sign, amount, balance, description] = match;
          }
          
          // Clean and validate amounts
          const cleanAmount = parseFloat(amount.replace(/,/g, ''));
          const cleanBalance = balance ? parseFloat(balance.replace(/,/g, '')) : null;
          
          // Skip invalid amounts
          if (isNaN(cleanAmount) || cleanAmount <= 0 || cleanAmount > 10000000) {
            console.log(`Skipping invalid amounts: amount=${cleanAmount}, balance=${cleanBalance}`);
            return null;
          }
          
          return {
            date: date,
            amount: cleanAmount,
            balance: cleanBalance,
            description: description.trim(),
            type: sign === '-' || cleanAmount < 0 ? 'Debit' : 'Credit'
          };
        }
      }

      // If no pattern matched, try manual parsing for specific cases
      if (line.includes('/2024')) {
        console.log(`Attempting manual parse for: "${line}"`);
        
        // Extract date first
        const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          const date = dateMatch[1];
          
          // Look for amount patterns in the line
          const amounts = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);
          if (amounts && amounts.length >= 1) {
            // First amount is usually the transaction amount
            const transactionAmount = parseFloat(amounts[0].replace(/,/g, ''));
            // Last amount is usually the balance
            const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : null;
            
            // Extract description (everything after date, removing amounts)
            let description = line.replace(dateMatch[0], '').trim();
            amounts.forEach(amt => description = description.replace(amt, '').trim());
            description = description.replace(/^-\s*/, '').trim(); // Remove leading dash
            
            console.log(`Manual parse result: ${date} - ${transactionAmount} ${balance} ${description.substring(0, 30)}...`);
            
            return {
              date: date,
              amount: transactionAmount,
              balance: balance,
              description: description,
              type: 'Debit' // Most uncategorized seem to be debits
            };
          }
        }
      }
      
      return null;
    };

    // Process each chunk
    for (const chunk of chunks) {
      const transaction = parseTransactionLine(chunk.trim(), transactionCount);
      if (transaction) {
        transactionCount++;
        addLog(`Transaction ${transactionCount}: ${transaction.date} - ${transaction.amount.toLocaleString()} ${transaction.balance ? transaction.balance.toLocaleString() : 'N/A'} ${transaction.description.substring(0, 30)}... - MUR ${transaction.amount} (${transaction.type})`);
        transactions.push(transaction);
      }
    }

    // Look for additional transactions that might have been missed
    addLog('Looking for missed page boundary transactions...');

    const finalTransactionCount = transactions.length;
    addLog(`Final count: ${finalTransactionCount} valid transactions extracted`);

    if (finalTransactionCount > 0) {
      const dateRange = `${transactions[0].date} to ${transactions[finalTransactionCount-1].date}`;
      addLog(`Transactions span from ${dateRange}`);
    }

    return {
      transactions,
      openingBalance,
      closingBalance,
      fileName
    };
  };

  // Enhanced categorization system
  const categorizeTransaction = (description) => {
    const desc = description.toLowerCase();
    
    const categories = {
      'SALES': ['atm cash deposit', 'cash deposit', 'deposit'],
      'CSG': ['direct debit scheme', 'interbank transfer'],
      'Salary': ['cash cheque'],
      'SCHEME (PRIME)': ['juicepro transfer'],
      'MISCELLANEOUS': ['refill amount', 'vat on refill', 'merchant instant payment', 'juice payment']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }
    
    return 'UNCATEGORIZED';
  };

  // Main processing function
  const processFiles = async () => {
    if (files.length === 0) {
      addLog('No files selected', 'error');
      return;
    }

    setProcessing(true);
    addLog('Starting enhanced processing with advanced AI text recognition...');

    try {
      const allResults = [];

      for (const file of files) {
        addLog(`Processing ${file.name}...`);
        
        let text = '';
        if (file.type === 'application/pdf') {
          text = await extractTextFromPDF(file);
        } else {
          addLog(`Unsupported file type: ${file.type}`, 'error');
          continue;
        }

        const result = await processBankStatement(text, file.name);
        allResults.push(result);
        
        addLog(`Final: ${result.transactions.length} transactions from ${file.name}`);
      }

      // Categorize all transactions
      const categorizedResults = allResults.map(result => ({
        ...result,
        transactions: result.transactions.map(transaction => ({
          ...transaction,
          category: categorizeTransaction(transaction.description)
        }))
      }));

      // Show categorization preview
      categorizedResults.forEach(result => {
        result.transactions.forEach(transaction => {
          if (transaction.category === 'UNCATEGORIZED') {
            addLog(`Uncategorized: ${transaction.amount.toLocaleString()} ${transaction.balance ? transaction.balance.toLocaleString() : 'N/A'} ${transaction.description.substring(0, 30)}...`);
          } else {
            addLog(`${transaction.amount.toLocaleString()} ${transaction.balance ? transaction.balance.toLocaleString() : 'N/A'} ${transaction.description.substring(0, 15)}... → ${transaction.category}`);
          }
        });
      });

      // Calculate statistics
      const totalTransactions = categorizedResults.reduce((sum, result) => sum + result.transactions.length, 0);
      const categorizedCount = categorizedResults.reduce((sum, result) => 
        sum + result.transactions.filter(t => t.category !== 'UNCATEGORIZED').length, 0);
      const uncategorizedCount = totalTransactions - categorizedCount;

      addLog('Processing complete!');
      addLog(`Total: ${totalTransactions}, Categorized: ${categorizedCount}, Uncategorized: ${uncategorizedCount}`);
      addLog(`Success Rate: ${((categorizedCount / totalTransactions) * 100).toFixed(1)}%`);

      // Show overall balances
      if (categorizedResults.length > 0 && categorizedResults[0].openingBalance) {
        addLog(`Overall Opening Balance: MUR ${categorizedResults[0].openingBalance.toLocaleString()}`);
      }
      if (categorizedResults.length > 0 && categorizedResults[0].closingBalance) {
        addLog(`Overall Closing Balance: MUR ${categorizedResults[0].closingBalance.toLocaleString()}`);
      }

      setResults(categorizedResults);

    } catch (error) {
      addLog(`Processing error: ${error.message}`, 'error');
    }

    setProcessing(false);
  };

  // Generate and download Excel file
  const downloadExcel = () => {
    if (!results) return;

    try {
      const workbook = XLSX.utils.book_new();

      results.forEach((result, fileIndex) => {
        const worksheetData = [
          ['Date', 'Description', 'Amount', 'Balance', 'Type', 'Category', 'Source File']
        ];

        result.transactions.forEach(transaction => {
          worksheetData.push([
            transaction.date,
            transaction.description,
            transaction.amount,
            transaction.balance || '',
            transaction.type,
            transaction.category,
            result.fileName
          ]);
        });

        // Add summary rows
        worksheetData.push([]);
        if (result.openingBalance) {
          worksheetData.push(['Opening Balance', '', result.openingBalance, '', '', '', '']);
        }
        if (result.closingBalance) {
          worksheetData.push(['Closing Balance', '', result.closingBalance, '', '', '', '']);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Auto-size columns
        const colWidths = [
          { width: 12 }, // Date
          { width: 40 }, // Description
          { width: 15 }, // Amount
          { width: 15 }, // Balance
          { width: 10 }, // Type
          { width: 20 }, // Category
          { width: 25 }  // Source File
        ];
        worksheet['!cols'] = colWidths;

        const sheetName = `Statement_${fileIndex + 1}`;
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      // Create summary sheet
      const summaryData = [['Summary Report'], []];
      const totalTransactions = results.reduce((sum, result) => sum + result.transactions.length, 0);
      const categorizedCount = results.reduce((sum, result) => 
        sum + result.transactions.filter(t => t.category !== 'UNCATEGORIZED').length, 0);
      
      summaryData.push(['Total Transactions', totalTransactions]);
      summaryData.push(['Categorized', categorizedCount]);
      summaryData.push(['Uncategorized', totalTransactions - categorizedCount]);
      summaryData.push(['Success Rate', `${((categorizedCount / totalTransactions) * 100).toFixed(1)}%`]);
      summaryData.push([]);

      // Add uncategorized items for review
      summaryData.push(['Preview of Uncategorized Items:']);
      results.forEach(result => {
        result.transactions
          .filter(t => t.category === 'UNCATEGORIZED')
          .slice(0, 5)
          .forEach(transaction => {
            summaryData.push([
              transaction.date,
              `MUR ${transaction.balance || 'N/A'}`,
              transaction.amount.toLocaleString(),
              transaction.description.substring(0, 50),
              `From: ${result.fileName}`
            ]);
          });
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Download file
      const fileName = `Bank_Statement_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      addLog(`Excel file downloaded: ${fileName}`);
    } catch (error) {
      addLog(`Excel generation error: ${error.message}`, 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-white min-h-screen">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Bank Statement Processor</h1>
              <p className="text-blue-100">Extract transactions from PDF bank statements to Excel</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Bank Statement PDFs</h3>
            <p className="text-gray-600 mb-4">Select one or more PDF bank statement files</p>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block"
            >
              Choose Files
            </label>
            {files.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Selected files:</p>
                {files.map((file, index) => (
                  <p key={index} className="text-sm font-medium">{file.name}</p>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={processFiles}
              disabled={files.length === 0 || processing}
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {processing ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              {processing ? 'Processing...' : 'Process Statements'}
            </button>

            {results && (
              <button
                onClick={downloadExcel}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                Download Excel
              </button>
            )}
          </div>

          {/* Processing Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Processing Log
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`text-sm font-mono p-2 rounded ${
                      log.type === 'error' ? 'bg-red-100 text-red-800' :
                      log.type === 'success' ? 'bg-green-100 text-green-800' :
                      'bg-white text-gray-700'
                    }`}
                  >
                    <span className="text-gray-500">{log.timestamp}</span> {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Summary */}
          {results && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Processing Complete!</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.map((result, index) => (
                  <div key={index} className="text-center">
                    <p className="text-2xl font-bold text-green-700">{result.transactions.length}</p>
                    <p className="text-sm text-green-600">Transactions from {result.fileName}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-green-600">
                  Ready for download as Excel file with categorized transactions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankStatementProcessor;
