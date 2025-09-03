export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ocrText, imageData, isImage, pageNumber } = req.body;
    
    if (isImage && imageData) {
      // Handle image OCR with Claude Vision
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Updated to use proper header name
          "x-api-key": process.env.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          // Updated to latest model
          model: "claude-sonnet-4-20250514",
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
                  text: "This is a bank statement page. Please extract ALL transaction data in a structured format. For each transaction, extract: date, description, amount, and balance. Return the raw text that would appear on this bank statement, preserving the original format as much as possible."
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const ocrText = data.content[0].text;
      
      res.status(200).json({ ocrText });
      
    } else {
      // Handle text enhancement
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [
            { 
              role: "user", 
              content: `Clean and structure this bank statement text. Fix OCR errors and ensure transaction data is properly formatted:

${ocrText}

Return the cleaned text maintaining the original bank statement structure.`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const enhancedText = data.content[0].text;
      
      res.status(200).json({ enhancedText });
    }
    
  } catch (error) {
    console.error('Enhancement error:', error);
    res.status(500).json({ 
      error: 'Enhancement failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
