// Excel Export Utilities - Enhanced with Separate Sheets per Document

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

// Simple grouping functions for user-selected grouping
const groupTransactionsByDescription = (transactions) => {
  const groups = {};
  
  transactions.forEach((transaction, index) => {
    // Extract key words from description for grouping
    const description = transaction.description.toLowerCase();
    
    // Simple keyword matching for common patterns
    let groupKey = 'OTHER';
    
    if (description.includes('atm') || description.includes('cash deposit')) {
      groupKey = 'ATM_CASH_DEPOSITS';
    } else if (description.includes('salary') || description.includes('staff')) {
      groupKey = 'SALARY_PAYMENTS';
    } else if (description.includes('transfer')) {
      groupKey = 'TRANSFERS';
    } else if (description.includes('ceb') || description.includes('cwa')) {
      groupKey = 'UTILITIES';
    } else if (description.includes('fee') || description.includes('charge')) {
      groupKey = 'BANK_FEES';
    } else if (description.includes('juice') || description.includes('maubank')) {
      groupKey = 'INTER_BANK_TRANSFERS';
    } else if (description.includes('mra') || description.includes('tax') || description.includes('csg')) {
      groupKey = 'TAX_PAYMENTS';
    } else {
      // Group by first few words of description
      const firstWords = description.split(' ').slice(0, 2).join(' ');
      groupKey = firstWords.toUpperCase().replace(/[^A-Z0-9]/g, '_') || 'OTHER';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push({...transaction, originalIndex: index});
  });
  
  return groups;
};

const groupTransactionsByDate = (transactions) => {
  const groups = {};
  
  transactions.forEach((transaction, index) => {
    // Extract month-year from transaction date
    const dateParts = transaction.transactionDate.split('/');
    const month = dateParts[1];
    const year = dateParts[2];
    const groupKey = `${year}-${month.padStart(2, '0')}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push({...transaction, originalIndex: index});
  });
  
  return groups;
};

// Create grouped worksheet maintaining original PDF order within each group
const createGroupedWorksheet = (XLSX, groups, groupType, metadata) => {
  const worksheetData = [];
  
  // Header
  worksheetData.push([`TRANSACTIONS GROUPED BY ${groupType.toUpperCase()}`]);
  worksheetData.push(['Generated on:', new Date().toLocaleDateString()]);
  worksheetData.push(['Maintains original document order within each group']);
  worksheetData.push([]);
  
  // Group summary
  worksheetData.push(['GROUP SUMMARY:']);
  worksheetData.push(['Group Name', 'Transaction Count', 'Total Amount (MUR)']);
  
  Object.entries(groups).forEach(([groupName, transactions]) => {
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    worksheetData.push([
      groupName.replace(/_/g, ' '),
      transactions.length,
      totalAmount.toFixed(2)
    ]);
  });
  
  worksheetData.push([]);
  worksheetData.push(['DETAILED TRANSACTIONS BY GROUP:']);
  worksheetData.push([]);
  
  // Detailed transactions by group
  Object.entries(groups).forEach(([groupName, transactions]) => {
    worksheetData.push([`=== ${groupName.replace(/_/g, ' ')} (${transactions.length} transactions) ===`]);
    worksheetData.push(['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Source File']);
    
    // Sort by original index to maintain PDF order within each group
    transactions
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .forEach(transaction => {
        worksheetData.push([
          transaction.transactionDate,
          transaction.valueDate,
          transaction.description,
          transaction.amount.toFixed(2),
          transaction.balance.toFixed(2),
          transaction.category,
          transaction.sourceFile
        ]);
      });
    
    worksheetData.push([]); // Empty row between groups
  });
  
  return XLSX.utils.aoa_to_sheet(worksheetData);
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
  const timestamp = new Date().toLocaleDateString();
  
  if (exportMode === 'separate') {
    // Generate separate Excel files for each document with optional grouping
    Object.keys(fileStats).forEach(fileName => {
      const fileData = fileStats[fileName];
      const metadata = statementMetadata[fileName] || {};
      
      if (fileData.status === 'success') {
        const wb = XLSX.utils.book_new();
        
        // Get transactions for this file
        const fileTransactions = [];
        Object.entries(results).forEach(([category, transactions]) => {
          transactions.filter(t => t.sourceFile === fileName).forEach(transaction => {
            fileTransactions.push({ ...transaction, category });
          });
        });
        
        // Add uncategorized transactions for this file
        uncategorizedData.filter(t => t.sourceFile === fileName).forEach(transaction => {
          fileTransactions.push({ ...transaction, category: 'UNCATEGORIZED' });
        });
        
        // ENHANCED HEADER WITH PROPER BALANCE DISPLAY
        const worksheetData = [
          ['BANK STATEMENT ANALYSIS - INDIVIDUAL DOCUMENT'],
          ['File Name:', fileName],
          ['Statement Period:', metadata.statementPeriod || 'Not specified'],
          ['Account Number:', metadata.accountNumber || 'Not specified'],
          ['IBAN:', metadata.iban || 'Not specified'],
          ['Currency:', metadata.currency || 'MUR'],
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
        
        // Add all transactions for this file - MAINTAIN ORIGINAL PDF ORDER
        fileTransactions.forEach(transaction => {
          worksheetData.push([
            transaction.transactionDate,
            transaction.valueDate,
            transaction.description,
            transaction.amount.toFixed(2),
            transaction.balance.toFixed(2),
            transaction.category,
            transaction.statementPeriod || metadata.statementPeriod || 'Not specified',
            transaction.accountNumber || metadata.accountNumber || 'Not specified',
            transaction.isDebit ? 'Debit' : 'Credit'
          ]);
        });
        
        // Create main worksheet
        const detailsWorksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(wb, detailsWorksheet, "Transaction Details");
        
        // NEW: Add grouped worksheet if grouping is enabled
        if (groupingConfig && groupingConfig.enabled && fileTransactions.length > 0) {
          let groupedData = null;
          
          if (groupingConfig.type === 'description') {
            groupedData = groupTransactionsByDescription(fileTransactions);
          } else if (groupingConfig.type === 'date') {
            groupedData = groupTransactionsByDate(fileTransactions);
          }
          
          if (groupedData) {
            const groupedWorksheet = createGroupedWorksheet(XLSX, groupedData, groupingConfig.type, metadata);
            const sheetName = groupingConfig.type === 'description' ? 'Grouped by Description' : 'Grouped by Date';
            XLSX.utils.book_append_sheet(wb, groupedWorksheet, sheetName);
          }
        }
        
        // Download file
        downloadExcelFile(wb, `${fileName.replace(/\.[^/.]+$/, "")}_Statement_Analysis.xlsx`);
      }
    });
    
    const groupingText = groupingConfig?.enabled ? ` with ${groupingConfig.type} grouping` : '';
    addLog(`${Object.keys(fileStats).length} Excel files downloaded successfully${groupingText}!`, 'success');
    
  } else {
    // ENHANCED COMBINED MODE - Each document gets its own sheet
    const wb = XLSX.utils.book_new();
    
    // Calculate totals from metadata
    const totalOpeningBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.openingBalance || 0), 0);
    const totalClosingBalance = Object.values(statementMetadata).reduce((sum, meta) => sum + (meta.closingBalance || 0), 0);
    const totalNetChange = totalClosingBalance - totalOpeningBalance;
    
    // CREATE SUMMARY SHEET FIRST
    const summaryData = [
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
      ['INDIVIDUAL DOCUMENT SUMMARY:'],
      ['File Name', 'Period', 'Account Number', 'Opening Balance', 'Closing Balance', 'Net Change', 'Transactions', 'Sheet Name']
    ];
    
    // Add each file's summary
    Object.entries(fileStats).forEach(([fileName, fileData], index) => {
      const metadata = statementMetadata[fileName] || {};
      
      if (fileData.status === 'success') {
        const docOpeningBalance = metadata.openingBalance || 0;
        const docClosingBalance = metadata.closingBalance || 0;
        const docNetChange = docClosingBalance - docOpeningBalance;
        const sheetName = `Document ${index + 1}`;
        
        summaryData.push([
          fileName,
          metadata.statementPeriod || 'Not specified',
          metadata.accountNumber || 'Not specified',
          `MUR ${docOpeningBalance.toLocaleString()}`,
          `MUR ${docClosingBalance.toLocaleString()}`,
          `MUR ${docNetChange.toLocaleString()}`,
          fileData.total || 0,
          sheetName
        ]);
      }
    });
    
    summaryData.push([]);
    summaryData.push(['NAVIGATION GUIDE:']);
    summaryData.push(['• Summary Sheet: This overview sheet']);
    summaryData.push(['• Document Sheets: Individual sheets for each bank statement']);
    summaryData.push(['• All Transactions: Consolidated view of all transactions']);
    summaryData.push(['• Use the sheet tabs at the bottom to navigate between sheets']);
    
    // Create and add summary worksheet
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWorksheet, "Summary");
    
    // CREATE SEPARATE SHEET FOR EACH DOCUMENT
    let documentIndex = 0;
    Object.entries(fileStats).forEach(([fileName, fileData]) => {
      const metadata = statementMetadata[fileName] || {};
      
      if (fileData.status === 'success') {
        documentIndex++;
        
        // Get transactions for this specific file
        const fileTransactions = [];
        Object.entries(results).forEach(([category, transactions]) => {
          transactions.filter(t => t.sourceFile === fileName).forEach(transaction => {
            fileTransactions.push({ ...transaction, category });
          });
        });
        
        // Add uncategorized transactions for this file
        uncategorizedData.filter(t => t.sourceFile === fileName).forEach(transaction => {
          fileTransactions.push({ ...transaction, category: 'UNCATEGORIZED' });
        });
        
        // Create worksheet data for this document
        const worksheetData = [
          [`DOCUMENT ${documentIndex}: ${fileName}`],
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
          [], // Empty row
          ['DETAILED TRANSACTIONS:'],
          ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Type']
        ];
        
        // Add transactions for this file
        fileTransactions.forEach(transaction => {
          worksheetData.push([
            transaction.transactionDate,
            transaction.valueDate,
            transaction.description,
            transaction.amount.toFixed(2),
            transaction.balance.toFixed(2),
            transaction.category,
            transaction.isDebit ? 'Debit' : 'Credit'
          ]);
        });
        
        // Create worksheet for this document
        const docWorksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const sheetName = `Document ${documentIndex}`;
        
        XLSX.utils.book_append_sheet(wb, docWorksheet, sheetName);
        
        // Add grouped worksheet if grouping is enabled for this document
        if (groupingConfig && groupingConfig.enabled && fileTransactions.length > 0) {
          let groupedData = null;
          
          if (groupingConfig.type === 'description') {
            groupedData = groupTransactionsByDescription(fileTransactions);
          } else if (groupingConfig.type === 'date') {
            groupedData = groupTransactionsByDate(fileTransactions);
          }
          
          if (groupedData) {
            const groupedWorksheet = createGroupedWorksheet(XLSX, groupedData, groupingConfig.type, metadata);
            const groupedSheetName = `Doc${documentIndex}_Grouped`;
            XLSX.utils.book_append_sheet(wb, groupedWorksheet, groupedSheetName);
          }
        }
      }
    });
    
    // CREATE CONSOLIDATED TRANSACTION SHEET (ALL TRANSACTIONS TOGETHER)
    const allTransactions = [];
    Object.entries(results).forEach(([category, transactions]) => {
      transactions.forEach(transaction => {
        allTransactions.push({ ...transaction, category });
      });
    });
    
    uncategorizedData.forEach(transaction => {
      allTransactions.push({ ...transaction, category: 'UNCATEGORIZED' });
    });
    
    const consolidatedData = [
      ['ALL TRANSACTIONS FROM ALL DOCUMENTS (CONSOLIDATED VIEW)'],
      ['Generated on:', timestamp],
      ['Total Documents:', Object.keys(fileStats).length],
      ['Total Transactions:', allTransactions.length],
      [], // Empty row
      ['Note: This sheet contains all transactions from all documents combined.'],
      ['Use the individual document sheets for detailed analysis of specific statements.'],
      [], // Empty row
      ['Date', 'Value Date', 'Description', 'Amount', 'Balance', 'Category', 'Source File', 'Account', 'Type']
    ];
    
    allTransactions.forEach(transaction => {
      consolidatedData.push([
        transaction.transactionDate,
        transaction.valueDate,
        transaction.description,
        transaction.amount.toFixed(2),
        transaction.balance.toFixed(2),
        transaction.category,
        transaction.sourceFile,
        transaction.accountNumber || 'Not specified',
        transaction.isDebit ? 'Debit' : 'Credit'
      ]);
    });
    
    const consolidatedWorksheet = XLSX.utils.aoa_to_sheet(consolidatedData);
    XLSX.utils.book_append_sheet(wb, consolidatedWorksheet, "All Transactions");
    
    // Add overall grouped worksheet if grouping is enabled
    if (groupingConfig && groupingConfig.enabled) {
      let groupedData = null;
      
      if (groupingConfig.type === 'description') {
        groupedData = groupTransactionsByDescription(allTransactions);
      } else if (groupingConfig.type === 'date') {
        groupedData = groupTransactionsByDate(allTransactions);
      }
      
      if (groupedData) {
        const groupedWorksheet = createGroupedWorksheet(XLSX, groupedData, groupingConfig.type, statementMetadata);
        const sheetName = groupingConfig.type === 'description' ? 'All_Grouped_Desc' : 'All_Grouped_Date';
        XLSX.utils.book_append_sheet(wb, groupedWorksheet, sheetName);
      }
    }
    
    // Download the combined workbook
    const groupingText = groupingConfig?.enabled ? `_with_${groupingConfig.type}_grouping` : '';
    const fileName = `Combined_Bank_Statements_${timestamp.replace(/\//g, '-')}${groupingText}.xlsx`;
    downloadExcelFile(wb, fileName);
    
    const groupingMsg = groupingConfig?.enabled ? ` with ${groupingConfig.type} grouping` : '';
    const successfulDocs = Object.keys(fileStats).filter(f => fileStats[f].status === 'success').length;
    const totalSheets = 2 + successfulDocs + (groupingConfig?.enabled ? successfulDocs + 1 : 0); // Summary + Documents + All Transactions + Grouped sheets
    addLog(`Combined Excel file created with ${totalSheets} sheets: Summary + ${successfulDocs} Document sheets + Consolidated view${groupingMsg}`, 'success');
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
