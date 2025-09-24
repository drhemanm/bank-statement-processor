// api/enhance-ocr.js - Fixed with proper error handling and model selection
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

  // Log for debugging
  console.log('Enhance OCR called');
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('API Key prefix:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not found in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured. Please check your Vercel environment variables.',
      timestamp: new Date().toISOString()
    });
  }

  // Check API key format (should start with sk-ant-)
  if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    console.error('Invalid API key format detected');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Invalid API key format. Key should start with "sk-ant-"',
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
      // IMAGE OCR with Claude Vision - Using Claude 3 Haiku for efficiency
      const visionPayload = {
        model: "claude-3-haiku-20240307", // Using Haiku for faster and cheaper processing
        max_tokens: 4000,
        temperature: 0.1,
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
   - Extract the EXACT numerical values with all decimal places

2. STATEMENT METADATA:
   - Account number (usually 10-12 digits)
   - Statement period (From DD/MM/YYYY to DD/MM/YYYY)
   - Account holder name
   - Currency (usually MUR)

3. TRANSACTION DATA:
   Extract EVERY transaction with these exact fields:
   - Transaction Date (DD/MM/YYYY format)
   - Value Date (DD/MM/YYYY format)
   - Description (complete text)
   - Debit amount (if applicable)
   - Credit amount (if applicable)
   - Balance after transaction

4. MCB SPECIFIC PATTERNS:
   Common transaction types:
   - ATM CASH WITHDRAWAL / RETRAIT
   - CASH DEPOSIT / VERSEMENT
   - STANDING ORDER
   - DIRECT DEBIT SCHEME
   - INTERBANK TRANSFER
   - MERCHANT INSTANT PAYMENT
   - JUICEPRO TRANSFER
   - POS transactions
   - Bank charges

Return the extracted text maintaining the original statement's structure.`
              }
            ]
          }
        ]
      };

      console.log('Sending vision request to Claude...');
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY, // Use x-api-key header
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(visionPayload)
      });

      const responseText = await response.text();
      console.log('Vision API Response Status:', response.status);

      if (!response.ok) {
        console.error(`Claude Vision API error: ${response.status}`, responseText);
        
        if (response.status === 401) {
          throw new Error('API authentication failed - Invalid API key');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded - please try again in a moment');
        } else if (response.status === 413) {
          throw new Error('Image too large - please reduce image size');
        } else {
          throw new Error(`Vision API request failed: ${response.status} - ${responseText.substring(0, 200)}`);
        }
      }

      const data = JSON.parse(responseText);
      
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
      // TEXT ENHANCEMENT with Claude - Using Haiku for efficiency
      const textPayload = {
        model: "claude-3-haiku-20240307", // Using Haiku for faster processing
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
   - Find and clearly mark OPENING BALANCE (may appear as "Balance Brought Forward", "Balance B/F")
   - Find and clearly mark CLOSING BALANCE (may appear as "Balance Carried Forward", "Balance C/F")
   - These balances MUST be preserved with exact numerical values

2. FIX MCB-SPECIFIC OCR ERRORS:
   - Fix common OCR issues: 0 vs O, 1 vs l, 5 vs S in numbers
   - Repair MCB transaction types:
     * ATM CASH WITHDRAWAL (not "ATH CASH MITHDRAMAL")
     * STANDING ORDER
     * DIRECT DEBIT SCHEME
     * INTERBANK TRANSFER
   - Fix "MUR" currency indicators

3. STRUCTURE TRANSACTION DATA:
   MCB statements typically follow:
   [Transaction Date] [Value Date] [Description] [Debit] [Credit] [Balance]
   
   Ensure each transaction line follows this pattern.

4. STANDARDIZE DATES AND AMOUNTS:
   - All dates in DD/MM/YYYY format
   - All amounts with 2 decimal places

5. PRESERVE CRITICAL INFORMATION:
   - Account numbers
   - Statement period dates
   - All monetary amounts
   - Running balance after each transaction

Return the enhanced text in a clean, structured format.`
          }
        ]
      };

      console.log('Sending text enhancement request to Claude...');
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY, // Use x-api-key header
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(textPayload)
      });

      const responseText = await response.text();
      console.log('Text API Response Status:', response.status);

      if (!response.ok) {
        console.error(`Claude Text API error: ${response.status}`, responseText);
        
        if (response.status === 401) {
          throw new Error('API authentication failed - Invalid API key');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded - please try again in a moment');
        } else {
          throw new Error(`Text enhancement API request failed: ${response.status}`);
        }
      }

      const data = JSON.parse(responseText);
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude Text API');
      }
      
      const enhancedText = data.content[0].text;
      console.log(`Text enhancement completed: ${enhancedText.length} characters`);
      
      // Validate MCB content
      const isMCB = enhancedText.toLowerCase().includes('mauritius commercial bank') || 
                    enhancedText.toLowerCase().includes('mcb') ||
                    enhancedText.toLowerCase().includes('mcb.mu');
      
      // Extract balances for validation
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
    if (error.message.includes('authentication') || error.message.includes('Invalid API key')) {
      statusCode = 401;
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
    } else if (error.message.includes('too large')) {
      statusCode = 413;
    }
    
    res.status(statusCode).json(errorResponse);
  }
}
