export default async function handler(req, res) {
  // Add CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not found in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured. Please check your environment variables.'
    });
  }

  try {
    const { ocrText, imageData, isImage, pageNumber } = req.body;
    
    // Validate input
    if (!ocrText && !imageData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Either ocrText or imageData must be provided'
      });
    }
    
    if (isImage && imageData) {
      // Handle image OCR with Claude Vision
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
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
                  text: `This is page ${pageNumber || 1} of a bank statement. Please extract ALL transaction data in a structured, readable format. 

For each transaction, identify:
- Transaction date
- Value date (if different)  
- Description/details
- Amount
- Running balance
- Whether it's a debit or credit

Return the text as it would appear on a clean bank statement, maintaining the tabular structure. Focus on accuracy and completeness. Preserve all numerical values exactly as shown.

If this appears to be account summary information (opening/closing balances, account details), include that as well.

Format the output as clean, structured text that can be easily parsed.`
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Anthropic API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Vision API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Anthropic Vision API');
      }
      
      const ocrText = data.content[0].text;
      
      res.status(200).json({ ocrText });
      
    } else {
      // Handle text enhancement
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4000,
          messages: [
            { 
              role: "user", 
              content: `You are helping to clean and structure OCR-extracted text from a bank statement (page ${pageNumber || 1}).

Original OCR text:
${ocrText}

Please:
1. Fix obvious OCR errors (like 'O' instead of '0', garbled characters)
2. Ensure proper spacing and alignment for transaction data  
3. Standardize date formats (DD/MM/YYYY)
4. Clean up numerical formatting (amounts and balances)
5. Preserve the original transaction order and structure
6. Maintain accuracy - don't guess or invent data

Return the cleaned text maintaining the bank statement's tabular structure. Each transaction should be clearly readable with proper spacing between columns.

Focus on making the transaction data easily parseable while maintaining accuracy.`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Anthropic API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Text enhancement API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Anthropic Text API');
      }
      
      const enhancedText = data.content[0].text;
      
      res.status(200).json({ enhancedText });
    }
    
  } catch (error) {
    console.error('Enhancement error:', error);
    
    // Return more detailed error information for debugging
    const errorResponse = {
      error: 'Enhancement failed',
      message: error.message,
      timestamp: new Date().toISOString()
    };
    
    // Include more debugging info in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.details = {
        apiKeyExists: !!process.env.ANTHROPIC_API_KEY,
        apiKeyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
        requestBody: req.body ? Object.keys(req.body) : null
      };
    }
    
    res.status(500).json(errorResponse);
  }
}
