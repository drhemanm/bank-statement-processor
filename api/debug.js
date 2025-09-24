export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Debug endpoint called at:', new Date().toISOString());
  console.log('Environment:', process.env.VERCEL_ENV || 'unknown');

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    
    // Enhanced API Key Debug
    apiKey: {
      exists: !!process.env.ANTHROPIC_API_KEY,
      length: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
      prefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'NOT FOUND',
      hasCorrectPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-api03-') : false,
      format: process.env.ANTHROPIC_API_KEY ? 'Valid format' : 'Missing'
    },
    
    // Environment variables analysis
    environment_vars: {
      anthropic_keys: Object.keys(process.env).filter(key => key.includes('ANTHROPIC')),
      total_env_vars: Object.keys(process.env).length,
      vercel_env: process.env.VERCEL_ENV,
      is_production: process.env.VERCEL_ENV === 'production',
      is_preview: process.env.VERCEL_ENV === 'preview',
      is_development: process.env.VERCEL_ENV === 'development'
    },
    
    // Test API functionality
    apiTestResult: null
  };

  // Test the API key if it exists
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Testing Anthropic API connectivity...');
    const testStartTime = Date.now();
    
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
          max_tokens: 10,
          messages: [{ 
            role: "user", 
            content: "Reply with just 'OK' to confirm API is working."
          }]
        })
      });

      const testDuration = Date.now() - testStartTime;

      if (testResponse.ok) {
        const testData = await testResponse.json();
        debugInfo.apiTestResult = {
          status: 'SUCCESS',
          statusCode: testResponse.status,
          responseTime: `${testDuration}ms`,
          message: 'API key is valid and working!',
          responsePreview: testData.content?.[0]?.text || 'No content',
          model: 'claude-3-5-sonnet-20241022'
        };
        console.log(`✅ API test successful in ${testDuration}ms`);
      } else {
        const errorText = await testResponse.text();
        let errorMessage = 'Unknown error';
        let troubleshooting = '';
        
        switch (testResponse.status) {
          case 401:
            errorMessage = 'Authentication failed';
            troubleshooting = 'Your API key is invalid or expired. Please check your Vercel environment variables.';
            break;
          case 403:
            errorMessage = 'Access forbidden';
            troubleshooting = 'Your API key may not have the required permissions.';
            break;
          case 429:
            errorMessage = 'Rate limit exceeded';
            troubleshooting = 'Too many requests. Wait a moment and try again.';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = 'Anthropic server error';
            troubleshooting = 'Anthropic service is temporarily unavailable. Try again later.';
            break;
          default:
            errorMessage = `HTTP ${testResponse.status} error`;
            troubleshooting = errorText.substring(0, 200);
        }
        
        debugInfo.apiTestResult = {
          status: 'FAILED',
          statusCode: testResponse.status,
          responseTime: `${testDuration}ms`,
          error: errorMessage,
          troubleshooting: troubleshooting,
          details: errorText.substring(0, 500)
        };
        console.error(`❌ API test failed: ${testResponse.status} - ${errorMessage}`);
      }

    } catch (error) {
      const testDuration = Date.now() - testStartTime;
      debugInfo.apiTestResult = {
        status: 'ERROR',
        error: error.message,
        responseTime: `${testDuration}ms`,
        troubleshooting: 'Network error - check internet connection or firewall settings'
      };
      console.error('❌ API test error:', error.message);
    }
  } else {
    debugInfo.apiTestResult = {
      status: 'NO_KEY',
      error: 'No API key found',
      troubleshooting: 'ANTHROPIC_API_KEY is not set in Vercel environment variables',
      checkpoints: [
        '1. Go to Vercel Dashboard',
        '2. Navigate to Settings → Environment Variables',
        '3. Ensure ANTHROPIC_API_KEY exists',
        '4. Check it\'s enabled for all environments',
        '5. Redeploy after adding/updating the key'
      ]
    };
    console.error('❌ No API key found in environment');
  }

  // Add summary
  debugInfo.summary = {
    ready: debugInfo.apiTestResult?.status === 'SUCCESS',
    message: debugInfo.apiTestResult?.status === 'SUCCESS' 
      ? '✅ Your AI enhancement system is ready!' 
      : '❌ API configuration needs attention',
    nextSteps: debugInfo.apiTestResult?.status !== 'SUCCESS'
      ? debugInfo.apiTestResult?.troubleshooting
      : 'Everything is configured correctly!'
  };

  res.status(200).json(debugInfo);
}
