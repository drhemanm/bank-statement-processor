// api/debug.js - Enhanced debugging with better error handling
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Debug endpoint called at:', new Date().toISOString());
  console.log('Environment:', process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown');

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    
    apiKey: {
      exists: !!process.env.ANTHROPIC_API_KEY,
      length: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
      prefix: process.env.ANTHROPIC_API_KEY ? 
        process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 
        'NOT FOUND',
      hasCorrectPrefix: process.env.ANTHROPIC_API_KEY ? 
        process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-') : 
        false
    },
    
    // List all environment variables (keys only for security)
    envVars: Object.keys(process.env).filter(key => 
      key.includes('ANTHROPIC') || 
      key.includes('VERCEL') || 
      key.includes('NODE')
    ),
    
    apiTestResult: null,
    mcbTestResult: null
  };

  // Test API if key exists
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Testing Anthropic API with key:', debugInfo.apiKey.prefix);
    
    try {
      const testResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY, // Also try x-api-key header
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY, // Primary header
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // Using Haiku for faster testing
          max_tokens: 100,
          messages: [{ 
            role: "user", 
            content: "Respond with 'OK' if you can process MCB bank statements."
          }]
        })
      });

      const responseText = await testResponse.text();
      console.log('API Response Status:', testResponse.status);
      console.log('API Response Headers:', Object.fromEntries(testResponse.headers.entries()));
      
      if (testResponse.ok) {
        try {
          const testData = JSON.parse(responseText);
          debugInfo.apiTestResult = {
            status: 'SUCCESS',
            statusCode: testResponse.status,
            message: 'API key is valid and working!',
            response: testData.content?.[0]?.text || 'No content',
            model: testData.model
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
        } catch (parseError) {
          debugInfo.apiTestResult = {
            status: 'PARSE_ERROR',
            statusCode: testResponse.status,
            error: 'Failed to parse response',
            rawResponse: responseText.substring(0, 200)
          };
        }
      } else {
        debugInfo.apiTestResult = {
          status: 'FAILED',
          statusCode: testResponse.status,
          error: `API request failed: ${testResponse.status}`,
          details: responseText.substring(0, 500)
        };
        
        // Specific error messages
        if (testResponse.status === 401) {
          debugInfo.apiTestResult.suggestion = 'Check if your API key is correct and starts with "sk-ant-"';
        } else if (testResponse.status === 400) {
          debugInfo.apiTestResult.suggestion = 'API key format may be incorrect';
        } else if (testResponse.status === 429) {
          debugInfo.apiTestResult.suggestion = 'Rate limit exceeded - try again later';
        }
      }

    } catch (error) {
      console.error('API test error:', error);
      debugInfo.apiTestResult = {
        status: 'ERROR',
        error: error.message,
        type: error.constructor.name
      };
    }
  } else {
    debugInfo.apiTestResult = {
      status: 'NO_KEY',
      error: 'No API key found in environment variables',
      suggestion: 'Please add ANTHROPIC_API_KEY in Vercel dashboard'
    };
  }

  // Summary
  debugInfo.summary = {
    ready: debugInfo.apiTestResult?.status === 'SUCCESS',
    message: debugInfo.apiTestResult?.status === 'SUCCESS' 
      ? '✅ MCB Statement Processor ready!' 
      : '❌ API configuration needed',
    nextSteps: debugInfo.apiTestResult?.status !== 'SUCCESS' 
      ? [
          '1. Go to Vercel Dashboard > Settings > Environment Variables',
          '2. Ensure ANTHROPIC_API_KEY is added (no quotes)',
          '3. Key should start with "sk-ant-"',
          '4. Redeploy after adding/updating the key'
        ]
      : null
  };

  res.status(200).json(debugInfo);
}
