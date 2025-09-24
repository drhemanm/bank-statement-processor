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
          // Fixed: Use the correct header name for the latest API
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          // Updated to latest model
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
                    media_type: "image/png",
                    data: imageData
                  }
                },
                {
                  type: "text",
                  text: "This is a bank statement page. Please extract ALL transaction data in a structured format. For each transaction, extract: date, description, amount, and balance. Return the raw text that would appear on this bank statement, preserving the original format as much as possible. Focus on accuracy and completeness."
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Anthropic API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Anthropic API');
      }
      
      const ocrText = data.content[0].text;
      
      res.status(200).json({ ocrText });
      
    } else {
      // Handle text enhancement
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4000,
          messages: [
            { 
              role: "user", 
              content: `Clean and structure this bank statement text. Fix OCR errors, improve formatting, and ensure transaction data is properly structured while maintaining accuracy. Focus on making dates, amounts, and descriptions clear and consistent:

${ocrText}

Return the cleaned text maintaining the original bank statement structure and transaction order. Ensure all numerical values and dates are accurate.`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Anthropic API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Anthropic API');
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
    
    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
    }
    
    res.status(500).json(errorResponse);
  }
}
