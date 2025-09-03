// Excel Export Utilities - Enhanced with Proper Balance Display

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
  statementMetadata, // ADDED MISSING PARAMETER
  addLog
) => {
  if (!results) {
    addLog('No results to download', 'error');
    return;
  }

  const XLSX = await loadXLSX();
  const timestamp = new Date().toLocaleDateString();
  
  if (exportMode === 'separate') {
    // Generate separate Excel files for each document - ENHANCED FORMAT
    Object.keys(fileStats).forEach(fileName => {
      const fileData = fileStats[fileName];
      const metadata = statementMetadata[fileName] || {}; // GET METADATA FOR THIS FILE
      
      if (fileData.status === 'success') {
        const wb = XLSX.utils.book_new();
        
        // ENHANCED HEADER WITH PROPER BALANCE DISPLAY
        const worksheetData = [
          // Enhanced Header Information
          ['BANK STATEMENT ANALYSIS - INDIVIDUAL DOCUMENT'],
          ['File Name:', fileName],
          ['Statement Period:', metadata.statementPeriod || fileData.statementPeriod || 'Not specified'],
          ['Account Number:', metadata.accountNumber || fileData.accountNumber || 'Not specified'],
          ['IBAN:', metadata.iban || fileData.iban || 'Not specified'],
          ['Currency:', metadata.currency || fileData.currency || 'MUR'],
          [], // Empty row for balance section
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
          ['Generated on:', timestamp],
          [], // Empty row
          // Transaction Headers
          ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Period', 'Account', 'Type']
        ];
        
        // Add all transactions for this file - ONE ROW PER TRANSACTION
        Object.entries(results).forEach(([category, transactions]) => {
          transactions.filter(t => t.sourceFile === fileName).forEach(transaction => {
            worksheetData.push([
              transaction.transactionDate,
              transaction.valueDate,
              transaction.description,
              transaction.amount.toFixed(2),
              transaction.balance.toFixed(2),
              category,
              transaction.statementPeriod || metadata.statementPeriod || 'Not specified',
              transaction.accountNumber || metadata.accountNumber || 'Not specified',
              transaction.isDebit ? 'Debit' : 'Credit'
            ]);
          });
        });
        
        // Add uncategorized transactions
        uncategorizedData.filter(t => t.sourceFile === fileName).forEach(transaction => {
          worksheetData.push([
            transaction.transactionDate,
            transaction.valueDate,
            transaction.description,
            transaction.amount.toFixed(2),
            transaction.balance.toFixed(2),
            'UNCATEGORIZED',
            transaction.statementPeriod || metadata.statementPeriod || 'Not specified',
            transaction.accountNumber || metadata.accountNumber || 'Not specified',
            transaction.isDebit ? 'Debit' : 'Credit'
          ]);
        });
        
        // Create single worksheet with all data
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(wb, worksheet, "Statement Analysis");
        
        // Download file
        downloadExcelFile(wb, `${fileName.replace(/\.[^/.]+$/, "")}_Statement_Analysis.xlsx`);
      }
    });
    
    addLog(`${Object.keys(fileStats).length} Excel files downloaded successfully!`, 'success');
    
  } else {
    // Generate combined Excel file - ENHANCED FORMAT
    const wb = XLSX.utils.book_new();
    
    // Calculate totals from metadata
    const totalOpeningBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.openingBalance || 0), 0);
    const totalClosingBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.closingBalance || 0), 0);
    const totalNetChange = totalClosingBalance - totalOpeningBalance;
    
    const worksheetData = [
      // Enhanced Combined Header Information
      ['CONSOLIDATED BANK STATEMENT ANALYSIS - MULTIPLE DOCUMENTS'],
      ['Generated on:', timestamp],
      ['Documents Processed:', Object.keys(fileStats).length],
      ['Total Transactions:', Object.values(fileStats).reduce((sum, stats) => sum + (stats.total || 0), 0)],
      [], // Empty row
      ['CONSOLIDATED BALANCE SUMMARY:'],
      ['Total Opening Balance:', `MUR ${totalOpeningBalance.toLocaleString()}`],
      ['Total Closing Balance:', `MUR ${totalClosingBalance.toLocaleString()}`],
      ['Net Change Across All Documents:', `MUR ${totalNetChange.toLocaleString()}`],
      [], // Empty row
      ['INDIVIDUAL DOCUMENT SUMMARY:']
    ];
    
    // Add each file's summary with enhanced balance information
    Object.entries(fileStats).forEach(([fileName, fileData]) => {
      const metadata = statementMetadata[fileName] || {};
      
      if (fileData.status === 'success') {
        const docOpeningBalance = metadata.openingBalance || 0;
        const docClosingBalance = metadata.closingBalance || 0;
        const docNetChange = docClosingBalance - docOpeningBalance;
        
        worksheetData.push([
          'File:', fileName,
          'Period:', metadata.statementPeriod || 'Not specified',
          'Account:', metadata.accountNumber || 'Not specified',
          'Opening Balance:', `MUR ${docOpeningBalance.toLocaleString()}`,
          'Closing Balance:', `MUR ${docClosingBalance.toLocaleString()}`,
          'Net Change:', `MUR ${docNetChange.toLocaleString()}`,
          'Transactions:', fileData.total || 0
        ]);
      }
    });
    
    worksheetData.push([]); // Empty row
    worksheetData.push(['ALL TRANSACTIONS FROM ALL DOCUMENTS:']);
    worksheetData.push(['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Period', 'Source File', 'Account', 'Type']);
    
    // Add ALL transactions - ONE ROW PER TRANSACTION
    Object.entries(results).forEach(([category, transactions]) => {
      transactions.forEach(transaction => {
        worksheetData.push([
          transaction.transactionDate,
          transaction.valueDate,
          transaction.description,
          transaction.amount.toFixed(2),
          transaction.balance.toFixed(2),
          category,
          transaction.statementPeriod || 'Not specified',
          transaction.sourceFile,
          transaction.accountNumber || 'Not specified',
          transaction.isDebit ? 'Debit' : 'Credit'
        ]);
      });
    });
    
    // Add uncategorized transactions
    uncategorizedData.forEach(transaction => {
      worksheetData.push([
        transaction.transactionDate,
        transaction.valueDate,
        transaction.description,
        transaction.amount.toFixed(2),
        transaction.balance.toFixed(2),
        'UNCATEGORIZED',
        transaction.statementPeriod || 'Not specified',
        transaction.sourceFile,
        transaction.accountNumber || 'Not specified',
        transaction.isDebit ? 'Debit' : 'Credit'
      ]);
    });
    
    // Create single worksheet with all data
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, worksheet, "All Statements");
    
    downloadExcelFile(wb, `Combined_Bank_Statements_${timestamp.replace(/\//g, '-')}.xlsx`);
    addLog('Combined Excel file downloaded successfully!', 'success');
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
