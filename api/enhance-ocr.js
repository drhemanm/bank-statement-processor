export default async function handler(req, res) {
  // Enhanced CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not found in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured. Please check your environment variables.',
      timestamp: new Date().toISOString()
    });
  }

  // Validate API key format
  if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-api03-')) {
    console.error('Invalid API key format detected');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Invalid API key format',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const { ocrText, imageData, isImage, pageNumber } = req.body;
    
    // Input validation
    if (!ocrText && !imageData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Either ocrText or imageData must be provided'
      });
    }

    console.log(`Processing page ${pageNumber || 1}: ${isImage ? 'Image OCR' : 'Text Enhancement'}`);
    
    if (isImage && imageData) {
      // IMAGE OCR with Claude Vision - Enhanced for MCB Bank Statements
      const visionPayload = {
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for accuracy
        messages: [
          { 
            role: "user", 
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageData.startsWith('/9j/') ? "image/jpeg" : "image/png",
                  data: imageData
                }
              },
              {
                type: "text",
                text: `You are extracting data from page ${pageNumber || 1} of a Mauritius Commercial Bank (MCB) statement.

CRITICAL EXTRACTION REQUIREMENTS:

1. BALANCE INFORMATION (HIGHEST PRIORITY):
   - Look for "Opening Balance", "Balance Brought Forward", "Balance B/F", "Solde Initial"
   - Look for "Closing Balance", "Balance Carried Forward", "Balance C/F", "Solde Final"
   - These are usually at the top and bottom of the statement
   - Extract the EXACT numerical values with all decimal places

2. STATEMENT METADATA:
   - Account number (usually 10-12 digits)
   - Statement period (From DD/MM/YYYY to DD/MM/YYYY)
   - Account holder name
   - Currency (usually MUR)
   - Page number

3. TRANSACTION DATA:
   Extract EVERY transaction with these exact fields:
   - Transaction Date (DD/MM/YYYY format)
   - Value Date (DD/MM/YYYY format - may be same as transaction date)
   - Description (complete text, including reference numbers)
   - Debit amount (if applicable)
   - Credit amount (if applicable)
   - Balance after transaction

4. MCB SPECIFIC PATTERNS:
   Common transaction types to recognize:
   - ATM CASH WITHDRAWAL / RETRAIT
   - CASH DEPOSIT / VERSEMENT
   - STANDING ORDER / ORDRE PERMANENT
   - DIRECT DEBIT SCHEME
   - INTERBANK TRANSFER
   - MERCHANT INSTANT PAYMENT
   - JUICEPRO TRANSFER
   - POS transactions
   - Bank charges and fees

5. FORMATTING REQUIREMENTS:
   - Preserve the exact structure as shown on the statement
   - Keep dates in DD/MM/YYYY format
   - Keep amounts with exactly 2 decimal places
   - Include currency symbols where shown (MUR, Rs)
   - Maintain the tabular structure

6. QUALITY CHECKS:
   - Ensure ALL transactions are captured (double-check for any missed lines)
   - Verify opening balance + transactions = closing balance
   - Check that all amounts are numeric and properly formatted
   - Ensure descriptions are complete (not cut off)

IMPORTANT: This is a financial document. Accuracy is critical. Extract EVERY piece of information exactly as shown.

Return the extracted text maintaining the original statement's structure and format.`
              }
            ]
          }
        ]
      };

      console.log('Sending vision request to Claude for MCB statement extraction...');
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "messages-2023-12-15"
        },
        body: JSON.stringify(visionPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Claude Vision API error: ${response.status}`, errorText);
        
        if (response.status === 401) {
          throw new Error('API authentication failed - please check your API key');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded - please try again in a moment');
        } else if (response.status === 413) {
          throw new Error('Image too large - please reduce image size');
        } else {
          throw new Error(`Vision API request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude Vision API');
      }
      
      const extractedText = data.content[0].text;
      console.log(`Vision OCR completed: ${extractedText.length} characters extracted`);
      
      // Validate MCB content
      const isMCB = extractedText.toLowerCase().includes('mauritius commercial bank') || 
                    extractedText.toLowerCase().includes('mcb') ||
                    extractedText.toLowerCase().includes('mcb.mu');
      
      res.status(200).json({ 
        ocrText: extractedText,
        method: 'claude-vision-mcb',
        pageNumber: pageNumber || 1,
        isMCBDocument: isMCB,
        timestamp: new Date().toISOString()
      });
      
    } else {
      // TEXT ENHANCEMENT with Claude - Enhanced for MCB format
      const textPayload = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          { 
            role: "user", 
            content: `You are processing OCR text from page ${pageNumber || 1} of a Mauritius Commercial Bank (MCB) statement.

ORIGINAL OCR TEXT:
${ocrText}

ENHANCEMENT TASKS FOR MCB STATEMENTS:

1. CRITICAL BALANCE EXTRACTION:
   - Find and clearly mark OPENING BALANCE (may appear as "Balance Brought Forward", "Balance B/F", "Solde Initial")
   - Find and clearly mark CLOSING BALANCE (may appear as "Balance Carried Forward", "Balance C/F", "Solde Final")
   - These balances MUST be preserved with exact numerical values

2. FIX MCB-SPECIFIC OCR ERRORS:
   - Fix common OCR issues: 0 vs O, 1 vs l, 5 vs S in numbers
   - Repair MCB transaction types:
     * ATM CASH WITHDRAWAL (not "ATH CASH MITHDRAMAL")
     * STANDING ORDER (not "STANDINC 0RDER")
     * DIRECT DEBIT SCHEME (not "DIRECT DEB1T 5CHEME")
     * INTERBANK TRANSFER (not "INTERBANK TRAN5FER")
   - Fix "MUR" currency indicators (not "HUR" or "MUP")

3. STRUCTURE TRANSACTION DATA:
   MCB statements typically follow this pattern:
   [Transaction Date] [Value Date] [Description] [Debit] [Credit] [Balance]
   
   OR sometimes:
   [Transaction Date] [Value Date] [Debit] [Credit] [Description] [Balance]
   
   Ensure each transaction line follows one of these patterns consistently.

4. STANDARDIZE MCB TRANSACTION DESCRIPTIONS:
   Common MCB transactions to recognize and fix:
   - ATM transactions (withdrawals and deposits)
   - Standing orders with beneficiary names
   - Direct debit schemes (often for utilities, insurance)
   - Interbank transfers (local and international)
   - JuicePro transfers (MCB's mobile banking)
   - POS/Merchant payments
   - Bank charges and fees
   - Cash deposits and withdrawals

5. PRESERVE CRITICAL INFORMATION:
   - Account numbers (10-12 digits)
   - Statement period dates
   - Transaction reference numbers
   - All monetary amounts with exactly 2 decimal places
   - Running balance after each transaction

6. DATE FORMAT STANDARDIZATION:
   - Ensure all dates are in DD/MM/YYYY format
   - Fix common date OCR errors (e.g., "O1/O3/2024" → "01/03/2024")

7. AMOUNT FORMAT STANDARDIZATION:
   - All amounts should have 2 decimal places (e.g., "1000" → "1000.00")
   - Remove any spurious characters from amounts
   - Ensure thousands separators are commas (e.g., "1,234.56")

VALIDATION CHECKLIST:
✓ Opening balance is clearly marked and visible
✓ Closing balance is clearly marked and visible
✓ All transactions have dates in DD/MM/YYYY format
✓ All amounts are numeric with 2 decimal places
✓ Transaction descriptions are complete and readable
✓ The document is identifiable as an MCB statement

IMPORTANT: This is a financial document from MCB. Maintain 100% accuracy of all numerical values.
Never change amounts unless fixing obvious OCR errors (like O instead of 0).

Return the enhanced text in a clean, structured format that preserves the tabular nature of the bank statement.`
          }
        ]
      };

      console.log('Sending text enhancement request to Claude for MCB statement...');
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(textPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Claude Text API error: ${response.status}`, errorText);
        
        if (response.status === 401) {
          throw new Error('API authentication failed - please check your API key');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded - please try again in a moment');
        } else {
          throw new Error(`Text enhancement API request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude Text API');
      }
      
      const enhancedText = data.content[0].text;
      console.log(`Text enhancement completed: ${enhancedText.length} characters`);
      
      // Validate MCB content and extract key information
      const isMCB = enhancedText.toLowerCase().includes('mauritius commercial bank') || 
                    enhancedText.toLowerCase().includes('mcb') ||
                    enhancedText.toLowerCase().includes('mcb.mu');
      
      // Try to extract opening and closing balance for validation
      let openingBalance = null;
      let closingBalance = null;
      
      const openingMatch = enhancedText.match(/opening\s+balance[:\s]*([\d,]+\.?\d*)/i) ||
                           enhancedText.match(/balance\s+brought\s+forward[:\s]*([\d,]+\.?\d*)/i);
      if (openingMatch) {
        openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
      }
      
      const closingMatch = enhancedText.match(/closing\s+balance[:\s]*([\d,]+\.?\d*)/i) ||
                           enhancedText.match(/balance\s+carried\s+forward[:\s]*([\d,]+\.?\d*)/i);
      if (closingMatch) {
        closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
      }
      
      res.status(200).json({ 
        enhancedText: enhancedText,
        originalLength: ocrText.length,
        enhancedLength: enhancedText.length,
        method: 'claude-text-enhancement-mcb',
        pageNumber: pageNumber || 1,
        isMCBDocument: isMCB,
        extractedBalances: {
          opening: openingBalance,
          closing: closingBalance
        },
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Enhancement error:', error);
    
    const errorResponse = {
      error: 'Enhancement failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      pageNumber: req.body?.pageNumber || 'unknown'
    };
    
    // Determine appropriate error status code
    let statusCode = 500;
    if (error.message.includes('authentication')) {
      statusCode = 401;
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
    } else if (error.message.includes('too large')) {
      statusCode = 413;
    }
    
    res.status(statusCode).json(errorResponse);
  }
}
