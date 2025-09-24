// Enhanced Excel Export with Category-Based Sheets for MCB Statements

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

export const generateExcelReport = async (
  results, 
  uncategorizedData, 
  fileStats, 
  exportMode, 
  documentCounters,
  statementMetadata,
  addLog,
  groupingConfig = null
) => {
  if (!results) {
    addLog('No results to download', 'error');
    return;
  }

  const XLSX = await loadXLSX();
  const timestamp = new Date().toLocaleDateString().replace(/\//g, '-');
  
  if (exportMode === 'separate') {
    // Generate separate Excel files for each document
    Object.keys(fileStats).forEach(fileName => {
      const fileData = fileStats[fileName];
      const metadata = statementMetadata[fileName] || {};
      
      if (fileData.status === 'success') {
        const wb = XLSX.utils.book_new();
        
        // Create Summary Sheet
        const summaryData = [
          ['MCB BANK STATEMENT ANALYSIS - INDIVIDUAL DOCUMENT'],
          ['File Name:', fileName],
          ['Statement Period:', metadata.statementPeriod || 'Not specified'],
          ['Account Number:', metadata.accountNumber || 'Not specified'],
          ['IBAN:', metadata.iban || 'Not specified'],
          ['Currency:', metadata.currency || 'MUR'],
          [], // Empty row
          ['BALANCE INFORMATION:'],
          ['Opening Balance:', `${metadata.currency || 'MUR'} ${(metadata.openingBalance || 0).toLocaleString()}`],
          ['Closing Balance:', `${metadata.currency || 'MUR'} ${(metadata.closingBalance || 0).toLocaleString()}`],
          ['Net Change:', `${metadata.currency || 'MUR'} ${((metadata.closingBalance || 0) - (metadata.openingBalance || 0)).toLocaleString()}`],
          [], // Empty row
          ['TRANSACTION SUMMARY:'],
          ['Total Transactions:', fileData.total || 0],
          ['Categorized:', fileData.categorized || 0],
          ['Uncategorized:', fileData.uncategorized || 0],
          ['Success Rate:', `${fileData.total > 0 ? ((fileData.categorized / fileData.total) * 100).toFixed(1) : 0}%`],
          ['Generated on:', new Date().toLocaleString()],
          [], // Empty row
          ['CATEGORY BREAKDOWN:'],
          ['Category', 'Count', 'Total Amount (MUR)']
        ];

        // Add category breakdown
        Object.entries(results).forEach(([category, transactions]) => {
          const fileTransactions = transactions.filter(t => t.sourceFile === fileName);
          if (fileTransactions.length > 0) {
            const totalAmount = fileTransactions.reduce((sum, t) => sum + t.amount, 0);
            summaryData.push([category, fileTransactions.length, totalAmount.toFixed(2)]);
          }
        });

        // Add uncategorized if any
        const fileUncategorized = uncategorizedData.filter(t => t.sourceFile === fileName);
        if (fileUncategorized.length > 0) {
          const totalAmount = fileUncategorized.reduce((sum, t) => sum + t.amount, 0);
          summaryData.push(['Uncategorized', fileUncategorized.length, totalAmount.toFixed(2)]);
        }

        const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWorksheet, "Summary");

        // Create separate sheet for each category with transactions
        Object.entries(results).forEach(([category, allTransactions]) => {
          const categoryTransactions = allTransactions.filter(t => t.sourceFile === fileName);
          
          if (categoryTransactions.length > 0) {
            const categoryData = [
              [`${category.toUpperCase()} TRANSACTIONS`],
              ['File:', fileName],
              ['Count:', categoryTransactions.length],
              ['Total Amount:', `MUR ${categoryTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`],
              [], // Empty row
              ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Type', 'Confidence']
            ];

            categoryTransactions.forEach(transaction => {
              categoryData.push([
                transaction.transactionDate,
                transaction.valueDate,
                transaction.description,
                transaction.amount.toFixed(2),
                transaction.balance.toFixed(2),
                transaction.isDebit ? 'Debit' : 'Credit',
                transaction.confidence ? (transaction.confidence * 100).toFixed(1) + '%' : 'N/A'
              ]);
            });

            const categoryWorksheet = XLSX.utils.aoa_to_sheet(categoryData);
            // Clean sheet name for Excel compatibility
            const sheetName = category.replace(/[\/\\*?[\]]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, categoryWorksheet, sheetName);
          }
        });

        // Create Uncategorized sheet if there are uncategorized transactions
        if (fileUncategorized.length > 0) {
          const uncategorizedSheetData = [
            ['UNCATEGORIZED TRANSACTIONS'],
            ['File:', fileName],
            ['Count:', fileUncategorized.length],
            ['Total Amount:', `MUR ${fileUncategorized.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`],
            [], // Empty row
            ['⚠️ ATTENTION: These transactions need manual categorization'],
            [], // Empty row
            ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Type', 'Reason']
          ];

          fileUncategorized.forEach(transaction => {
            uncategorizedSheetData.push([
              transaction.transactionDate,
              transaction.valueDate,
              transaction.description,
              transaction.amount.toFixed(2),
              transaction.balance.toFixed(2),
              transaction.isDebit ? 'Debit' : 'Credit',
              transaction.reason || 'No pattern match'
            ]);
          });

          const uncategorizedWorksheet = XLSX.utils.aoa_to_sheet(uncategorizedSheetData);
          XLSX.utils.book_append_sheet(wb, uncategorizedWorksheet, "Uncategorized");
        }
        
        // Download file
        const cleanFileName = fileName.replace(/\.[^/.]+$/, "").replace(/[\/\\*?[\]]/g, '_');
        downloadExcelFile(wb, `${cleanFileName}_MCB_Analysis_${timestamp}.xlsx`);
      }
    });
    
    addLog(`${Object.keys(fileStats).length} Excel files with category sheets downloaded successfully!`, 'success');
    
  } else {
    // COMBINED MODE - Single Excel with category-based sheets
    const wb = XLSX.utils.book_new();
    
    // Calculate totals from metadata
    const totalOpeningBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.openingBalance || 0), 0);
    const totalClosingBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.closingBalance || 0), 0);
    const totalNetChange = totalClosingBalance - totalOpeningBalance;
    
    // CREATE SUMMARY SHEET
    const summaryData = [
      ['MCB BANK STATEMENT ANALYSIS - CONSOLIDATED REPORT'],
      ['Generated on:', new Date().toLocaleString()],
      ['Documents Processed:', Object.keys(fileStats).length],
      [], // Empty row
      ['CONSOLIDATED BALANCE SUMMARY:'],
      ['Total Opening Balance:', `MUR ${totalOpeningBalance.toLocaleString()}`],
      ['Total Closing Balance:', `MUR ${totalClosingBalance.toLocaleString()}`],
      ['Net Change Across All Documents:', `MUR ${totalNetChange.toLocaleString()}`],
      [], // Empty row
      ['TRANSACTION SUMMARY BY CATEGORY:'],
      ['Category', 'Transaction Count', 'Total Amount (MUR)', 'Percentage of Total']
    ];

    // Calculate total transactions and amounts for percentages
    const allTransactions = Object.values(results).flat().concat(uncategorizedData);
    const totalTransactionAmount = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Add each category summary
    Object.entries(results).forEach(([category, transactions]) => {
      if (transactions.length > 0) {
        const categoryAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
        const percentage = totalTransactionAmount > 0 ? ((categoryAmount / totalTransactionAmount) * 100).toFixed(1) : '0.0';
        summaryData.push([
          category,
          transactions.length,
          categoryAmount.toFixed(2),
          `${percentage}%`
        ]);
      }
    });

    // Add uncategorized summary
    if (uncategorizedData.length > 0) {
      const uncategorizedAmount = uncategorizedData.reduce((sum, t) => sum + t.amount, 0);
      const percentage = totalTransactionAmount > 0 ? ((uncategorizedAmount / totalTransactionAmount) * 100).toFixed(1) : '0.0';
      summaryData.push([
        'Uncategorized',
        uncategorizedData.length,
        uncategorizedAmount.toFixed(2),
        `${percentage}%`
      ]);
    }

    summaryData.push([]);
    summaryData.push(['DOCUMENT BREAKDOWN:']);
    summaryData.push(['File Name', 'Period', 'Opening Balance', 'Closing Balance', 'Transactions', 'Success Rate']);

    // Add individual document summaries
    Object.entries(fileStats).forEach(([fileName, fileData]) => {
      const metadata = statementMetadata[fileName] || {};
      
      if (fileData.status === 'success') {
        summaryData.push([
          fileName,
          metadata.statementPeriod || 'Not specified',
          `MUR ${(metadata.openingBalance || 0).toLocaleString()}`,
          `MUR ${(metadata.closingBalance || 0).toLocaleString()}`,
          fileData.total || 0,
          `${fileData.successRate || 0}%`
        ]);
      }
    });

    summaryData.push([]);
    summaryData.push(['NAVIGATION GUIDE:']);
    summaryData.push(['• Summary: This overview sheet']);
    summaryData.push(['• Category Sheets: Each category has its own sheet with all transactions']);
    summaryData.push(['• Uncategorized: Transactions that need manual review']);
    summaryData.push(['• Use the sheet tabs at the bottom to navigate between categories']);

    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWorksheet, "Summary");

    // CREATE SEPARATE SHEET FOR EACH CATEGORY
    Object.entries(results).forEach(([category, transactions]) => {
      if (transactions.length > 0) {
        const categoryData = [
          [`${category.toUpperCase()} - ALL TRANSACTIONS`],
          ['Category:', category],
          ['Total Transactions:', transactions.length],
          ['Total Amount:', `MUR ${transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`],
          ['Average Amount:', `MUR ${(transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length).toLocaleString()}`],
          [], // Empty row
          ['BREAKDOWN BY DOCUMENT:']
        ];

        // Add document breakdown for this category
        const documentBreakdown = {};
        transactions.forEach(t => {
          if (!documentBreakdown[t.sourceFile]) {
            documentBreakdown[t.sourceFile] = { count: 0, amount: 0 };
          }
          documentBreakdown[t.sourceFile].count++;
          documentBreakdown[t.sourceFile].amount += t.amount;
        });

        categoryData.push(['Document', 'Count', 'Amount (MUR)']);
        Object.entries(documentBreakdown).forEach(([fileName, data]) => {
          categoryData.push([fileName, data.count, data.amount.toFixed(2)]);
        });

        categoryData.push([]);
        categoryData.push(['DETAILED TRANSACTIONS:']);
        categoryData.push(['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Type', 'Source File', 'Confidence']);

        // Sort transactions by date
        transactions
          .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate))
          .forEach(transaction => {
            categoryData.push([
              transaction.transactionDate,
              transaction.valueDate,
              transaction.description,
              transaction.amount.toFixed(2),
              transaction.balance.toFixed(2),
              transaction.isDebit ? 'Debit' : 'Credit',
              transaction.sourceFile,
              transaction.confidence ? (transaction.confidence * 100).toFixed(1) + '%' : 'N/A'
            ]);
          });

        const categoryWorksheet = XLSX.utils.aoa_to_sheet(categoryData);
        // Clean sheet name for Excel compatibility and limit to 31 characters
        const sheetName = category.replace(/[\/\\*?[\]]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, categoryWorksheet, sheetName);
      }
    });

    // CREATE UNCATEGORIZED SHEET
    if (uncategorizedData.length > 0) {
      const uncategorizedSheetData = [
        ['UNCATEGORIZED TRANSACTIONS - REQUIRES MANUAL REVIEW'],
        ['⚠️ ATTENTION: These transactions could not be automatically categorized'],
        ['Total Uncategorized:', uncategorizedData.length],
        ['Total Amount:', `MUR ${uncategorizedData.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`],
        [], // Empty row
        ['COMMON REASONS FOR NON-CATEGORIZATION:'],
        ['• New transaction types not in the mapping rules'],
        ['• Unusual transaction descriptions'],
        ['• Formatting variations in bank data'],
        ['• Missing or incomplete transaction details'],
        [], // Empty row
        ['BREAKDOWN BY DOCUMENT:']
      ];

      // Add document breakdown for uncategorized
      const uncategorizedByDoc = {};
      uncategorizedData.forEach(t => {
        if (!uncategorizedByDoc[t.sourceFile]) {
          uncategorizedByDoc[t.sourceFile] = { count: 0, amount: 0 };
        }
        uncategorizedByDoc[t.sourceFile].count++;
        uncategorizedByDoc[t.sourceFile].amount += t.amount;
      });

      uncategorizedSheetData.push(['Document', 'Count', 'Amount (MUR)']);
      Object.entries(uncategorizedByDoc).forEach(([fileName, data]) => {
        uncategorizedSheetData.push([fileName, data.count, data.amount.toFixed(2)]);
      });

      uncategorizedSheetData.push([]);
      uncategorizedSheetData.push(['DETAILED UNCATEGORIZED TRANSACTIONS:']);
      uncategorizedSheetData.push(['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Type', 'Source File', 'Reason']);

      uncategorizedData
        .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate))
        .forEach(transaction => {
          uncategorizedSheetData.push([
            transaction.transactionDate,
            transaction.valueDate,
            transaction.description,
            transaction.amount.toFixed(2),
            transaction.balance.toFixed(2),
            transaction.isDebit ? 'Debit' : 'Credit',
            transaction.sourceFile,
            transaction.reason || 'No pattern match found'
          ]);
        });

      const uncategorizedWorksheet = XLSX.utils.aoa_to_sheet(uncategorizedSheetData);
      XLSX.utils.book_append_sheet(wb, uncategorizedWorksheet, "Uncategorized");
    }

    // CREATE ALL TRANSACTIONS SHEET (for reference)
    const allTransactionData = [
      ['ALL TRANSACTIONS - CONSOLIDATED VIEW'],
      ['This sheet contains every transaction from all documents for reference'],
      ['Total Transactions:', allTransactions.length],
      ['Total Amount:', `MUR ${allTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`],
      [], // Empty row
      ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Type', 'Source File']
    ];

    allTransactions
      .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate))
      .forEach(transaction => {
        allTransactionData.push([
          transaction.transactionDate,
          transaction.valueDate,
          transaction.description,
          transaction.amount.toFixed(2),
          transaction.balance.toFixed(2),
          transaction.category || 'Uncategorized',
          transaction.isDebit ? 'Debit' : 'Credit',
          transaction.sourceFile
        ]);
      });

    const allTransactionsWorksheet = XLSX.utils.aoa_to_sheet(allTransactionData);
    XLSX.utils.book_append_sheet(wb, allTransactionsWorksheet, "All Transactions");

    // Download the combined workbook
    const fileName = `MCB_Statements_Analysis_${timestamp}.xlsx`;
    downloadExcelFile(wb, fileName);
    
    const categoryCount = Object.keys(results).filter(category => results[category].length > 0).length;
    const totalSheets = 2 + categoryCount + (uncategorizedData.length > 0 ? 1 : 0) + 1; // Summary + Categories + Uncategorized + All Transactions
    addLog(`Combined Excel file created with ${totalSheets} sheets: Summary + ${categoryCount} Category sheets + ${uncategorizedData.length > 0 ? 'Uncategorized + ' : ''}All Transactions`, 'success');
  }
};

// Helper function to download Excel file
const downloadExcelFile = (workbook, filename) => {
  const excelBuffer = window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
