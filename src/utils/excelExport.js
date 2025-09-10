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
