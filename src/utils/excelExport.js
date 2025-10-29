// Enhanced Excel Export for MCB Bank Statements
// FIXED VERSION - Properly separates transaction data into columns

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

// Helper function to format currency
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'MUR 0.00';
  return `MUR ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return dateStr;
};

// Helper to safely parse numbers
const safeParseFloat = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
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
    addLog('❌ No data to export', 'error');
    return;
  }

  const XLSX = await loadXLSX();
  const timestamp = new Date().toISOString().split('T')[0];
  
  try {
    if (exportMode === 'separate') {
      // SEPARATE MODE - One Excel per document
      await generateSeparateFiles(XLSX, results, uncategorizedData, fileStats, statementMetadata, timestamp, addLog);
    } else {
      // COMBINED MODE - Single Excel with all data
      await generateCombinedFile(XLSX, results, uncategorizedData, fileStats, statementMetadata, timestamp, addLog);
    }
  } catch (error) {
    addLog(`❌ Export failed: ${error.message}`, 'error');
    throw error;
  }
};

// Generate separate Excel files for each document
const generateSeparateFiles = async (XLSX, results, uncategorizedData, fileStats, statementMetadata, timestamp, addLog) => {
  let filesGenerated = 0;
  
  for (const [fileName, fileStat] of Object.entries(fileStats)) {
    if (fileStat.status !== 'success') continue;
    
    const wb = XLSX.utils.book_new();
    const metadata = statementMetadata[fileName] || {};
    
    // 1. COVER SHEET with comprehensive summary
    const coverData = [
      ['MCB BANK STATEMENT ANALYSIS'],
      [''],
      ['DOCUMENT INFORMATION'],
      ['File Name:', fileName],
      ['Processing Date:', new Date().toLocaleString()],
      ['Statement Period:', metadata.statementPeriod || 'Not specified'],
      ['Account Number:', metadata.accountNumber || 'Not specified'],
      ['Bank:', 'Mauritius Commercial Bank Ltd.'],
      ['Currency:', 'MUR (Mauritian Rupee)'],
      [''],
      ['BALANCE SUMMARY'],
      ['Opening Balance:', formatCurrency(metadata.openingBalance || 0)],
      ['Closing Balance:', formatCurrency(metadata.closingBalance || 0)],
      ['Net Change:', formatCurrency((metadata.closingBalance || 0) - (metadata.openingBalance || 0))],
      [''],
      ['TRANSACTION SUMMARY'],
      ['Total Transactions:', fileStat.total || 0],
      ['Successfully Categorized:', fileStat.categorized || 0],
      ['Uncategorized (Need Review):', fileStat.uncategorized || 0],
      ['Categorization Success Rate:', `${fileStat.successRate || 0}%`],
      [''],
      ['CATEGORY BREAKDOWN'],
      ['Category', 'Count', 'Debit Amount', 'Credit Amount', 'Net Amount']
    ];

    // Add category summaries
    let totalDebits = 0;
    let totalCredits = 0;
    
    Object.entries(results).forEach(([category, transactions]) => {
      const categoryTrans = transactions.filter(t => t.sourceFile === fileName);
      if (categoryTrans.length > 0) {
        const debits = categoryTrans.filter(t => t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
        const credits = categoryTrans.filter(t => !t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
        totalDebits += debits;
        totalCredits += credits;
        
        coverData.push([
          category,
          categoryTrans.length,
          formatCurrency(debits),
          formatCurrency(credits),
          formatCurrency(credits - debits)
        ]);
      }
    });

    // Add uncategorized summary
    const fileUncategorized = uncategorizedData.filter(t => t.sourceFile === fileName);
    if (fileUncategorized.length > 0) {
      const uncatDebits = fileUncategorized.filter(t => t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
      const uncatCredits = fileUncategorized.filter(t => !t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
      totalDebits += uncatDebits;
      totalCredits += uncatCredits;
      
      coverData.push([
        '⚠️ UNCATEGORIZED',
        fileUncategorized.length,
        formatCurrency(uncatDebits),
        formatCurrency(uncatCredits),
        formatCurrency(uncatCredits - uncatDebits)
      ]);
    }

    // Add totals
    coverData.push(['']);
    coverData.push([
      'TOTALS',
      fileStat.total || 0,
      formatCurrency(totalDebits),
      formatCurrency(totalCredits),
      formatCurrency(totalCredits - totalDebits)
    ]);

    const coverSheet = XLSX.utils.aoa_to_sheet(coverData);
    
    // Apply column widths
    coverSheet['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 }
    ];
    
    XLSX.utils.book_append_sheet(wb, coverSheet, "Summary");

    // 2. ALL TRANSACTIONS SHEET (chronological order)
    const allTransData = [
      ['ALL TRANSACTIONS - CHRONOLOGICAL ORDER'],
      [''],
      ['Transaction Date', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance', 'Category', 'Type']
    ];

    // Combine all transactions for this file
    const allFileTrans = [];
    Object.entries(results).forEach(([category, trans]) => {
      trans.filter(t => t.sourceFile === fileName).forEach(t => {
        allFileTrans.push({ ...t, category });
      });
    });
    fileUncategorized.forEach(t => {
      allFileTrans.push({ ...t, category: 'Uncategorized' });
    });

    // Sort by date
    allFileTrans.sort((a, b) => {
      try {
        const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
        const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
        return dateA - dateB;
      } catch (e) {
        return 0;
      }
    });

    allFileTrans.forEach(transaction => {
      allTransData.push([
        formatDate(transaction.transactionDate),
        formatDate(transaction.valueDate),
        transaction.description,
        transaction.isDebit ? safeParseFloat(transaction.amount) : '',
        !transaction.isDebit ? safeParseFloat(transaction.amount) : '',
        safeParseFloat(transaction.balance),
        transaction.category,
        transaction.isDebit ? 'Debit' : 'Credit'
      ]);
    });

    const allTransSheet = XLSX.utils.aoa_to_sheet(allTransData);
    allTransSheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 50 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 }
    ];
    
    XLSX.utils.book_append_sheet(wb, allTransSheet, "All Transactions");

    // 3. CATEGORY SHEETS - FIXED: Each field in its own column
    Object.entries(results).forEach(([category, transactions]) => {
      const categoryTrans = transactions.filter(t => t.sourceFile === fileName);
      if (categoryTrans.length === 0) return;

      const categoryData = [
        [`${category.toUpperCase()} TRANSACTIONS`],
        [''],
        ['Summary:'],
        [`Total Transactions: ${categoryTrans.length}`],
        [`Total Debits: ${formatCurrency(categoryTrans.filter(t => t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0))}`],
        [`Total Credits: ${formatCurrency(categoryTrans.filter(t => !t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0))}`],
        [''],
        ['Transaction Date', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance', 'Confidence']
      ];

      categoryTrans
        .sort((a, b) => {
          try {
            const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
            const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
            return dateA - dateB;
          } catch (e) {
            return 0;
          }
        })
        .forEach(transaction => {
          // CRITICAL FIX: Each field goes into its own column
          categoryData.push([
            formatDate(transaction.transactionDate),
            formatDate(transaction.valueDate),
            transaction.description || '',
            transaction.isDebit ? safeParseFloat(transaction.amount) : '',
            !transaction.isDebit ? safeParseFloat(transaction.amount) : '',
            safeParseFloat(transaction.balance),
            transaction.confidence ? `${(transaction.confidence * 100).toFixed(0)}%` : 'N/A'
          ]);
        });

      const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
      categorySheet['!cols'] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 50 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 }
      ];

      const sheetName = category.replace(/[\/\\*?[\]]/g, '_').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, categorySheet, sheetName);
    });

    // 4. UNCATEGORIZED SHEET (critical for review)
    if (fileUncategorized.length > 0) {
      const uncategorizedSheetData = [
        ['⚠️ UNCATEGORIZED TRANSACTIONS - REQUIRES MANUAL REVIEW'],
        [''],
        ['These transactions could not be automatically categorized and need manual classification.'],
        ['Please review each transaction and assign appropriate categories.'],
        [''],
        [`Total Uncategorized: ${fileUncategorized.length}`],
        [`Total Amount: ${formatCurrency(fileUncategorized.reduce((sum, t) => sum + safeParseFloat(t.amount), 0))}`],
        [''],
        ['Transaction Date', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance', 'Suggested Category', 'Notes']
      ];

      fileUncategorized
        .sort((a, b) => {
          try {
            const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
            const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
            return dateA - dateB;
          } catch (e) {
            return 0;
          }
        })
        .forEach(transaction => {
          uncategorizedSheetData.push([
            formatDate(transaction.transactionDate),
            formatDate(transaction.valueDate),
            transaction.description || '',
            transaction.isDebit ? safeParseFloat(transaction.amount) : '',
            !transaction.isDebit ? safeParseFloat(transaction.amount) : '',
            safeParseFloat(transaction.balance),
            '[Manual Entry Required]',
            transaction.reason || 'No matching pattern found'
          ]);
        });

      const uncategorizedSheet = XLSX.utils.aoa_to_sheet(uncategorizedSheetData);
      uncategorizedSheet['!cols'] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 50 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 30 }
      ];

      XLSX.utils.book_append_sheet(wb, uncategorizedSheet, "⚠️ UNCATEGORIZED");
    }

    // Generate filename and download
    const cleanFileName = fileName.replace(/\.[^/.]+$/, "").replace(/[\/\\*?[\]]/g, '_');
    const outputFileName = `${cleanFileName}_MCB_Analysis_${timestamp}.xlsx`;
    
    XLSX.writeFile(wb, outputFileName);
    filesGenerated++;
    addLog(`✅ Generated: ${outputFileName}`, 'success');
  }
  
  addLog(`✅ Successfully generated ${filesGenerated} Excel file(s)`, 'success');
};

// Generate combined Excel file with all documents
const generateCombinedFile = async (XLSX, results, uncategorizedData, fileStats, statementMetadata, timestamp, addLog) => {
  const wb = XLSX.utils.book_new();
  
  // Calculate consolidated totals
  let consolidatedOpeningBalance = 0;
  let consolidatedClosingBalance = 0;
  let totalDocuments = 0;
  
  Object.entries(statementMetadata).forEach(([fileName, metadata]) => {
    if (fileStats[fileName]?.status === 'success') {
      consolidatedOpeningBalance += metadata.openingBalance || 0;
      consolidatedClosingBalance += metadata.closingBalance || 0;
      totalDocuments++;
    }
  });

  // 1. CONSOLIDATED SUMMARY SHEET
  const summaryData = [
    ['MCB BANK STATEMENTS - CONSOLIDATED ANALYSIS'],
    [''],
    ['PROCESSING INFORMATION'],
    ['Generated Date:', new Date().toLocaleString()],
    ['Documents Processed:', totalDocuments],
    ['Export Mode:', 'Combined (All documents in one file)'],
    [''],
    ['CONSOLIDATED BALANCE SUMMARY'],
    ['Total Opening Balance (All Documents):', formatCurrency(consolidatedOpeningBalance)],
    ['Total Closing Balance (All Documents):', formatCurrency(consolidatedClosingBalance)],
    ['Net Change Across All Documents:', formatCurrency(consolidatedClosingBalance - consolidatedOpeningBalance)],
    [''],
    ['DOCUMENT DETAILS'],
    ['Document Name', 'Statement Period', 'Opening Balance', 'Closing Balance', 'Net Change', 'Transactions', 'Success Rate']
  ];

  // Add individual document details
  Object.entries(fileStats).forEach(([fileName, fileStat]) => {
    if (fileStat.status === 'success') {
      const metadata = statementMetadata[fileName] || {};
      summaryData.push([
        fileName,
        metadata.statementPeriod || 'Not specified',
        formatCurrency(metadata.openingBalance || 0),
        formatCurrency(metadata.closingBalance || 0),
        formatCurrency((metadata.closingBalance || 0) - (metadata.openingBalance || 0)),
        fileStat.total || 0,
        `${fileStat.successRate || 0}%`
      ]);
    }
  });

  // Add category summary
  summaryData.push(['']);
  summaryData.push(['CATEGORY ANALYSIS (ALL DOCUMENTS)']);
  summaryData.push(['Category', 'Transaction Count', 'Total Debits', 'Total Credits', 'Net Amount', '% of Total']);

  const allTransactions = Object.values(results).flat().concat(uncategorizedData);
  const totalAmount = allTransactions.reduce((sum, t) => sum + safeParseFloat(t.amount), 0);

  Object.entries(results).forEach(([category, transactions]) => {
    if (transactions.length > 0) {
      const debits = transactions.filter(t => t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
      const credits = transactions.filter(t => !t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
      const percentage = totalAmount > 0 ? ((debits + credits) / totalAmount * 100).toFixed(1) : '0.0';
      
      summaryData.push([
        category,
        transactions.length,
        formatCurrency(debits),
        formatCurrency(credits),
        formatCurrency(credits - debits),
        `${percentage}%`
      ]);
    }
  });

  // Add uncategorized summary
  if (uncategorizedData.length > 0) {
    const uncatDebits = uncategorizedData.filter(t => t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
    const uncatCredits = uncategorizedData.filter(t => !t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
    const percentage = totalAmount > 0 ? ((uncatDebits + uncatCredits) / totalAmount * 100).toFixed(1) : '0.0';
    
    summaryData.push([
      '⚠️ UNCATEGORIZED',
      uncategorizedData.length,
      formatCurrency(uncatDebits),
      formatCurrency(uncatCredits),
      formatCurrency(uncatCredits - uncatDebits),
      `${percentage}%`
    ]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [
    { wch: 35 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 }
  ];
  
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // 2. ALL TRANSACTIONS SHEET (all documents combined)
  const allTransData = [
    ['ALL TRANSACTIONS - CONSOLIDATED VIEW'],
    [''],
    ['Date', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance', 'Category', 'Type', 'Source Document']
  ];

  allTransactions
    .sort((a, b) => {
      try {
        const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
        const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
        return dateA - dateB;
      } catch (e) {
        return 0;
      }
    })
    .forEach(transaction => {
      allTransData.push([
        formatDate(transaction.transactionDate),
        formatDate(transaction.valueDate),
        transaction.description || '',
        transaction.isDebit ? safeParseFloat(transaction.amount) : '',
        !transaction.isDebit ? safeParseFloat(transaction.amount) : '',
        safeParseFloat(transaction.balance),
        transaction.category || 'Uncategorized',
        transaction.isDebit ? 'Debit' : 'Credit',
        transaction.sourceFile || ''
      ]);
    });

  const allTransSheet = XLSX.utils.aoa_to_sheet(allTransData);
  allTransSheet['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 50 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 10 },
    { wch: 40 }
  ];
  
  XLSX.utils.book_append_sheet(wb, allTransSheet, "All Transactions");

  // 3. CATEGORY SHEETS (combined from all documents) - CRITICAL FIX
  Object.entries(results).forEach(([category, transactions]) => {
    if (transactions.length === 0) return;

    const categoryData = [
      [`${category.toUpperCase()} - ALL DOCUMENTS`],
      [''],
      ['Category Summary:'],
      [`Total Transactions: ${transactions.length}`],
      [`Total Debits: ${formatCurrency(transactions.filter(t => t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0))}`],
      [`Total Credits: ${formatCurrency(transactions.filter(t => !t.isDebit).reduce((sum, t) => sum + safeParseFloat(t.amount), 0))}`],
      [''],
      ['BREAKDOWN BY DOCUMENT:'],
      ['Document', 'Count', 'Debits', 'Credits', 'Net']
    ];

    // Group by document
    const docBreakdown = {};
    transactions.forEach(t => {
      if (!docBreakdown[t.sourceFile]) {
        docBreakdown[t.sourceFile] = { count: 0, debits: 0, credits: 0 };
      }
      docBreakdown[t.sourceFile].count++;
      if (t.isDebit) {
        docBreakdown[t.sourceFile].debits += safeParseFloat(t.amount);
      } else {
        docBreakdown[t.sourceFile].credits += safeParseFloat(t.amount);
      }
    });

    Object.entries(docBreakdown).forEach(([doc, data]) => {
      categoryData.push([
        doc,
        data.count,
        formatCurrency(data.debits),
        formatCurrency(data.credits),
        formatCurrency(data.credits - data.debits)
      ]);
    });

    categoryData.push(['']);
    categoryData.push(['TRANSACTION DETAILS:']);
    categoryData.push(['Date', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance', 'Document', 'Confidence']);

    transactions
      .sort((a, b) => {
        try {
          const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
          const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
          return dateA - dateB;
        } catch (e) {
          return 0;
        }
      })
      .forEach(transaction => {
        // CRITICAL FIX: Each field in its own column - NOT concatenated
        categoryData.push([
          formatDate(transaction.transactionDate),
          formatDate(transaction.valueDate),
          transaction.description || '',
          transaction.isDebit ? safeParseFloat(transaction.amount) : '',
          !transaction.isDebit ? safeParseFloat(transaction.amount) : '',
          safeParseFloat(transaction.balance),
          transaction.sourceFile || '',
          transaction.confidence ? `${(transaction.confidence * 100).toFixed(0)}%` : 'N/A'
        ]);
      });

    const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
    categorySheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 50 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 }
    ];

    const sheetName = category.replace(/[\/\\*?[\]]/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, categorySheet, sheetName);
  });

  // 4. UNCATEGORIZED SHEET
  if (uncategorizedData.length > 0) {
    const uncategorizedSheetData = [
      ['⚠️ UNCATEGORIZED TRANSACTIONS - REQUIRE MANUAL REVIEW'],
      [''],
      ['ATTENTION: These transactions could not be automatically categorized.'],
      ['Please review each transaction and assign appropriate categories.'],
      [''],
      [`Total Uncategorized: ${uncategorizedData.length}`],
      [`Total Amount: ${formatCurrency(uncategorizedData.reduce((sum, t) => sum + safeParseFloat(t.amount), 0))}`],
      [''],
      ['BREAKDOWN BY DOCUMENT:'],
      ['Document', 'Count', 'Amount']
    ];

    // Group uncategorized by document
    const uncatByDoc = {};
    uncategorizedData.forEach(t => {
      if (!uncatByDoc[t.sourceFile]) {
        uncatByDoc[t.sourceFile] = { count: 0, amount: 0 };
      }
      uncatByDoc[t.sourceFile].count++;
      uncatByDoc[t.sourceFile].amount += safeParseFloat(t.amount);
    });

    Object.entries(uncatByDoc).forEach(([doc, data]) => {
      uncategorizedSheetData.push([doc, data.count, formatCurrency(data.amount)]);
    });

    uncategorizedSheetData.push(['']);
    uncategorizedSheetData.push(['TRANSACTION DETAILS:']);
    uncategorizedSheetData.push(['Date', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance', 'Document', 'Suggested Category', 'Notes']);

    uncategorizedData
      .sort((a, b) => {
        try {
          const dateA = new Date(a.transactionDate.split('/').reverse().join('-'));
          const dateB = new Date(b.transactionDate.split('/').reverse().join('-'));
          return dateA - dateB;
        } catch (e) {
          return 0;
        }
      })
      .forEach(transaction => {
        uncategorizedSheetData.push([
          formatDate(transaction.transactionDate),
          formatDate(transaction.valueDate),
          transaction.description || '',
          transaction.isDebit ? safeParseFloat(transaction.amount) : '',
          !transaction.isDebit ? safeParseFloat(transaction.amount) : '',
          safeParseFloat(transaction.balance),
          transaction.sourceFile || '',
          '[Manual Entry Required]',
          transaction.reason || 'No matching pattern'
        ]);
      });

    const uncategorizedSheet = XLSX.utils.aoa_to_sheet(uncategorizedSheetData);
    uncategorizedSheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 50 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 40 },
      { wch: 20 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, uncategorizedSheet, "⚠️ UNCATEGORIZED");
  }

  // 5. BALANCE TRACKING SHEET
  const balanceData = [
    ['BALANCE TRACKING & RECONCILIATION'],
    [''],
    ['DOCUMENT BALANCES'],
    ['Document', 'Opening Balance', 'Total Debits', 'Total Credits', 'Calculated Closing', 'Stated Closing', 'Difference']
  ];

  Object.entries(statementMetadata).forEach(([fileName, metadata]) => {
    if (fileStats[fileName]?.status === 'success') {
      // Calculate debits and credits for this file
      let fileDebits = 0;
      let fileCredits = 0;
      
      Object.values(results).forEach(transactions => {
        transactions.filter(t => t.sourceFile === fileName).forEach(t => {
          if (t.isDebit) fileDebits += safeParseFloat(t.amount);
          else fileCredits += safeParseFloat(t.amount);
        });
      });
      
      uncategorizedData.filter(t => t.sourceFile === fileName).forEach(t => {
        if (t.isDebit) fileDebits += safeParseFloat(t.amount);
        else fileCredits += safeParseFloat(t.amount);
      });
      
      const calculatedClosing = (metadata.openingBalance || 0) - fileDebits + fileCredits;
      const difference = (metadata.closingBalance || 0) - calculatedClosing;
      
      balanceData.push([
        fileName,
        formatCurrency(metadata.openingBalance || 0),
        formatCurrency(fileDebits),
        formatCurrency(fileCredits),
        formatCurrency(calculatedClosing),
        formatCurrency(metadata.closingBalance || 0),
        formatCurrency(difference)
      ]);
    }
  });

  // Add consolidated totals
  balanceData.push(['']);
  balanceData.push([
    'CONSOLIDATED TOTALS',
    formatCurrency(consolidatedOpeningBalance),
    '', // Will calculate
    '', // Will calculate
    '', // Will calculate
    formatCurrency(consolidatedClosingBalance),
    ''
  ]);

  const balanceSheet = XLSX.utils.aoa_to_sheet(balanceData);
  balanceSheet['!cols'] = [
    { wch: 40 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 }
  ];
  
  XLSX.utils.book_append_sheet(wb, balanceSheet, "Balance Tracking");

  // Download the file
  const outputFileName = `MCB_Consolidated_Analysis_${timestamp}.xlsx`;
  XLSX.writeFile(wb, outputFileName);
  
  addLog(`✅ Generated consolidated Excel: ${outputFileName}`, 'success');
  addLog(`📊 Included ${Object.keys(results).filter(cat => results[cat].length > 0).length} categories + ${uncategorizedData.length > 0 ? '1 uncategorized sheet' : 'no uncategorized'}`, 'success');
};
