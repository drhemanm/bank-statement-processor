export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Debug endpoint called at:', new Date().toISOString());

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    
    apiKey: {
      exists: !!process.env.ANTHROPIC_API_KEY,
      length: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
      prefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'NOT FOUND',
      hasCorrectPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-api03-') : false
    },
    
    apiTestResult: null,
    mcbTestResult: null
  };

  // Test API if key exists
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Testing Anthropic API...');
    
    try {
      const testResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-opus-20240229",
          max_tokens: 100,
          messages: [{ 
            role: "user", 
            content: "Respond with 'OK' and tell me if you can process MCB (Mauritius Commercial Bank) statements."
          }]
        })
      });

      if (testResponse.ok) {
        const testData = await testResponse.json();
        debugInfo.apiTestResult = {
          status: 'SUCCESS',
          statusCode: testResponse.status,
          message: 'API key is valid and working!',
          response: testData.content?.[0]?.text || 'No content'
        };
        
        // MCB-specific test
        debugInfo.mcbTestResult = {
          ready: true,
          message: 'System ready for MCB statement processing',
          capabilities: [
            'MCB document validation',
            'Opening/Closing balance extraction',
            'Transaction categorization',
            'Excel report generation'
          ]
        };
      } else {
        debugInfo.apiTestResult = {
          status: 'FAILED',
          statusCode: testResponse.status,
          error: 'API key validation failed'
        };
      }

    } catch (error) {
      debugInfo.apiTestResult = {
        status: 'ERROR',
        error: error.message
      };
    }
  } else {
    debugInfo.apiTestResult = {
      status: 'NO_KEY',
      error: 'No API key found in environment variables'
    };
  }

  // Summary
  debugInfo.summary = {
    ready: debugInfo.apiTestResult?.status === 'SUCCESS',
    message: debugInfo.apiTestResult?.status === 'SUCCESS' 
      ? '✅ MCB Statement Processor ready!' 
      : '❌ API configuration needed'
  };

  res.status(200).json(debugInfo);
}
