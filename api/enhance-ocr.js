export default async function handler(req, res) {
  // Enhanced CORS headers for production
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

  // Enhanced API key validation
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
    
    // Enhanced input validation
    if (!ocrText && !imageData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Either ocrText or imageData must be provided'
      });
    }

    // Validate image data if provided
    if (isImage && imageData) {
      if (typeof imageData !== 'string' || imageData.length < 100) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Invalid image data format'
        });
      }
    }

    // Validate text data if provided
    if (ocrText && (typeof ocrText !== 'string' || ocrText.trim().length < 10)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Text content too short for meaningful processing'
      });
    }
    
    console.log(`Processing page ${pageNumber || 1}: ${isImage ? 'Image OCR' : 'Text Enhancement'}`);
    
    if (isImage && imageData) {
      // Enhanced Image OCR with Claude Vision
      const visionPayload = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
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
                text: `This is page ${pageNumber || 1} of a bank statement. Please extract ALL transaction data with maximum accuracy.

CRITICAL REQUIREMENTS:
1. Extract EVERY transaction visible on this page
2. For each transaction, identify:
   - Transaction date (DD/MM/YYYY format)
   - Value date (if different from transaction date)  
   - Complete description/details
   - Amount (preserve exact numbers)
   - Running balance after transaction
   - Whether it's a debit (-) or credit (+)

3. PRESERVE ALL NUMERICAL VALUES EXACTLY as shown
4. Include account information if visible (account number, IBAN, etc.)
5. Include statement period and balance information
6. Maintain the original structure and order of transactions

FORMATTING REQUIREMENTS:
- Return clean, structured text that maintains the bank statement's tabular format
- Each transaction should be on its own line
- Use consistent spacing between columns
- Ensure dates are in DD/MM/YYYY format
- Include currency symbols where present
- Preserve all decimal places in amounts

QUALITY ASSURANCE:
- Double-check all numbers for accuracy
- Ensure no transactions are missed
- Verify date formats are consistent
- Make sure descriptions are complete and readable

Return the extracted text as it would appear on a perfectly clean, digitized bank statement.`
              }
            ]
          }
        ],
        temperature: 0.1 // Low temperature for maximum accuracy
      };

      console.log('Sending vision request to Claude...');
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
        console.error(`Claude Vision API error: ${response.status} ${response.statusText}`, errorText);
        
        // Enhanced error handling for different status codes
        if (response.status === 401) {
          throw new Error('API authentication failed - please check your API key');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded - please try again in a moment');
        } else if (response.status === 413) {
          throw new Error('Image too large - please reduce image size');
        } else {
          throw new Error(`Vision API request failed: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude Vision API');
      }
      
      const extractedText = data.content[0].text;
      console.log(`Vision OCR completed for page ${pageNumber}: ${extractedText.length} characters extracted`);
      
      res.status(200).json({ 
        ocrText: extractedText,
        method: 'claude-vision',
        pageNumber: pageNumber || 1,
        timestamp: new Date().toISOString()
      });
      
    } else {
      // Enhanced Text Enhancement with Claude
      const textPayload = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [
          { 
            role: "user", 
            content: `You are an expert at cleaning and structuring OCR-extracted text from bank statements. This is page ${pageNumber || 1} of a bank statement that needs enhancement.

ORIGINAL OCR TEXT:
${ocrText}

ENHANCEMENT TASKS:
1. Fix OCR errors:
   - Correct '0' vs 'O' confusion in numbers
   - Fix garbled characters and spacing issues
   - Repair broken words and merged text
   - Standardize punctuation and formatting

2. Structure transaction data:
   - Align transaction columns properly
   - Ensure consistent date formatting (DD/MM/YYYY)
   - Clean up numerical formatting (amounts and balances)
   - Preserve original transaction order
   - Fix description text that may be split across lines

3. Standardize formatting:
   - Consistent spacing between data columns
   - Proper alignment of numerical values
   - Clear separation between different transactions
   - Maintain readable table structure

4. Preserve accuracy:
   - Never change numerical values unless fixing obvious OCR errors
   - Keep all original transaction data
   - Don't invent or guess missing information
   - Maintain the exact sequence of transactions

5. Bank statement elements to preserve:
   - Account numbers and identifiers
   - Statement periods and dates
   - Opening and closing balances
   - All transaction details
   - Bank name and branch information

CRITICAL REQUIREMENTS:
- Maintain 100% accuracy of financial data
- Fix only obvious OCR errors, don't interpret or guess
- Preserve the tabular structure for easy parsing
- Ensure each transaction is clearly separated
- Return clean, professionally formatted text

Return the enhanced text that looks like a perfect, cleanly formatted bank statement page.`
          }
        ],
        temperature: 0.1 // Low temperature for consistency
      };

      console.log('Sending text enhancement request to Claude...');
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
        console.error(`Claude Text API error: ${response.status} ${response.statusText}`, errorText);
        
        if (response.status === 401) {
          throw new Error('API authentication failed - please check your API key');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded - please try again in a moment');
        } else {
          throw new Error(`Text enhancement API request failed: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude Text API');
      }
      
      const enhancedText = data.content[0].text;
      console.log(`Text enhancement completed for page ${pageNumber}: ${enhancedText.length} characters`);
      
      res.status(200).json({ 
        enhancedText: enhancedText,
        originalLength: ocrText.length,
        enhancedLength: enhancedText.length,
        method: 'claude-text-enhancement',
        pageNumber: pageNumber || 1,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Enhancement error:', error);
    
    // Detailed error response for debugging
    const errorResponse = {
      error: 'Enhancement failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      pageNumber: req.body?.pageNumber || 'unknown'
    };
    
    // Include debugging info in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.details = {
        apiKeyExists: !!process.env.ANTHROPIC_API_KEY,
        apiKeyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
        apiKeyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'Not found',
        requestBodyKeys: req.body ? Object.keys(req.body) : null,
        hasImageData: !!(req.body?.imageData),
        hasOcrText: !!(req.body?.ocrText),
        textLength: req.body?.ocrText ? req.body.ocrText.length : 0
      };
    }
    
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
