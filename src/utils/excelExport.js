// Excel Export Utilities - Simplified Format for Client

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
  stats,
  addLog
) => {
  if (!results) {
    addLog('No results to download', 'error');
    return;
  }

  const XLSX = await loadXLSX();
  const timestamp = new Date().toLocaleDateString();
  
  if (exportMode === 'separate') {
    // Generate separate Excel files for each document - SIMPLIFIED FORMAT
    Object.keys(fileStats).forEach(fileName => {
      const fileData = fileStats[fileName];
      if (fileData.status === 'success') {
        const wb = XLSX.utils.book_new();
        
        // SIMPLE HEADER + TRANSACTION FORMAT (What client wants!)
        const worksheetData = [
          // Header Information
          ['BANK STATEMENT ANALYSIS'],
          ['File Name:', fileName],
          ['Statement Period:', fileData.statementPeriod || 'Not specified'],
          ['Account Number:', fileData.accountNumber || 'Not specified'],
          ['IBAN:', fileData.iban || 'Not specified'],
          ['Currency:', fileData.currency || 'MUR'],
          ['Opening Balance:', fileData.openingBalance.toLocaleString()],
          ['Closing Balance:', fileData.closingBalance.toLocaleString()],
          ['Generated on:', timestamp],
          [], // Empty row
          // Transaction Headers
          ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Period', 'Type']
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
              transaction.statementPeriod || fileData.statementPeriod || 'Not specified',
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
            transaction.statementPeriod || fileData.statementPeriod || 'Not specified',
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
    // Generate combined Excel file - SIMPLIFIED FORMAT
    const wb = XLSX.utils.book_new();
    
    const worksheetData = [
      // Combined Header Information
      ['CONSOLIDATED BANK STATEMENT ANALYSIS'],
      ['Generated on:', timestamp],
      ['Documents Processed:', Object.keys(fileStats).length],
      ['Total Transactions:', stats.totalTransactions],
      [], // Empty row
      // Document Summary
      ['DOCUMENT SUMMARY:']
    ];
    
    // Add each file's summary
    Object.entries(fileStats).forEach(([fileName, fileData]) => {
      if (fileData.status === 'success') {
        worksheetData.push([
          'File:', fileName,
          'Period:', fileData.statementPeriod || 'Not specified',
          'Account:', fileData.accountNumber || 'Not specified',
          'Transactions:', fileData.total
        ]);
      }
    });
    
    worksheetData.push([]); // Empty row
    worksheetData.push(['ALL TRANSACTIONS:']);
    worksheetData.push(['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Period', 'Source File', 'Type']);
    
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
