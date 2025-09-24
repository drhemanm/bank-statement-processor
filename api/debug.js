// Create this file: api/debug.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    
    // API Key Debug
    apiKeyExists: !!process.env.ANTHROPIC_API_KEY,
    apiKeyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
    apiKeyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'Not found',
    apiKeyHasCorrectPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-api03-') : false,
    
    // All environment variables containing ANTHROPIC
    anthropicEnvVars: Object.keys(process.env).filter(key => key.includes('ANTHROPIC')),
    
    // Test API call
    apiTestResult: null
  };

  // Test the API key if it exists
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const testResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "Hi" }]
        })
      });

      debugInfo.apiTestResult = {
        status: testResponse.status,
        statusText: testResponse.statusText,
        success: testResponse.ok,
        responsePreview: testResponse.ok ? "API key works!" : await testResponse.text()
      };

    } catch (error) {
      debugInfo.apiTestResult = {
        error: error.message,
        success: false
      };
    }
  }

  res.status(200).json(debugInfo);
}
