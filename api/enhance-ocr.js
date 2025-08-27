export default async function handler(req, res) {
  // Only allow POST requests (security)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the OCR text from your website
    const { ocrText } = req.body;
    
    // Send request to Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,  // Your secret key
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 3000,
        messages: [
          { 
            role: "user", 
            content: `Extract and clean bank statement transactions from this OCR text. Fix any obvious OCR errors (like 0->O, 8->B, 1->I).

OCR TEXT:
${ocrText}

Return ONLY a JSON array of transactions in this exact format:
[
  {
    "date": "DD/MM/YYYY",
    "description": "cleaned description", 
    "amount": 123.45,
    "type": "debit"
  }
]

Fix any OCR mistakes you see. Make sure dates are valid, amounts are numbers, and descriptions make sense.`
          }
        ]
      })
    });

    // Get Claude's response
    const data = await response.json();
    const enhancedText = data.content[0].text;
    
    // Send cleaned data back to your website
    res.status(200).json({ enhancedData: enhancedText });
    
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Enhancement failed' });
  }
}
