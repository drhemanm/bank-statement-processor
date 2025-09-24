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
    environment: process.env.NODE_ENV || 'unknown',
    
    // Enhanced API Key Debug
    apiKey: {
      exists: !!process.env.ANTHROPIC_API_KEY,
      length: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
      prefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'Not found',
      hasCorrectPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-api03-') : false,
      format: process.env.ANTHROPIC_API_KEY ? 'Valid format' : 'Invalid or missing'
    },
    
    // Environment variables analysis
    environment_vars: {
      anthropic_keys: Object.keys(process.env).filter(key => key.includes('ANTHROPIC')),
      node_env: process.env.NODE_ENV,
      vercel_env: process.env.VERCEL_ENV,
      total_env_vars: Object.keys(process.env).length
    },
    
    // Server info
    server: {
      platform: process.platform,
      node_version: process.version,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    },
    
    // Test API functionality
    apiTestResult: null,
    performanceTest: null
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
            content: "Hello! Just testing the API connection. Please respond with just 'OK'."
          }]
        })
      });

      const testDuration = Date.now() - testStartTime;

      if (testResponse.ok) {
        const testData = await testResponse.json();
        debugInfo.apiTestResult = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          success: true,
          responseTime: `${testDuration}ms`,
          responsePreview: testData.content?.[0]?.text || 'No content in response',
          usage: testData.usage || 'No usage info'
        };
        console.log(`API test successful in ${testDuration}ms`);
      } else {
        const errorText = await testResponse.text();
        debugInfo.apiTestResult = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          success: false,
          responseTime: `${testDuration}ms`,
          error: errorText.substring(0, 500) + (errorText.length > 500 ? '...' : ''),
          troubleshooting: getApiTroubleshooting(testResponse.status)
        };
        console.error(`API test failed: ${testResponse.status} ${testResponse.statusText}`);
      }

    } catch (error) {
      const testDuration = Date.now() - testStartTime;
      debugInfo.apiTestResult = {
        error: error.message,
        success: false,
        responseTime: `${testDuration}ms`,
        troubleshooting: 'Network error - check internet connection and firewall settings'
      };
      console.error('API test error:', error.message);
    }

    // Performance test with a more realistic request
    try {
      const perfStartTime = Date.now();
      const perfResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ 
            role: "user", 
            content: "This is a bank statement text processing test. Please clean this sample text: '01/01/2024 SALARY PAYMENT 5000.00 15000.00'. Respond with cleaned version."
          }]
        })
      });

      const perfDuration = Date.now() - perfStartTime;
      
      if (perfResponse.ok) {
        const perfData = await perfResponse.json();
        debugInfo.performanceTest = {
          success: true,
          responseTime: `${perfDuration}ms`,
          inputTokens: perfData.usage?.input_tokens || 'Unknown',
          outputTokens: perfData.usage?.output_tokens || 'Unknown',
          performance_rating: perfDuration < 2000 ? 'Excellent' : perfDuration < 5000 ? 'Good' : 'Slow'
        };
      }
    } catch (perfError) {
      debugInfo.performanceTest = {
        success: false,
        error: perfError.message
      };
    }
  } else {
    debugInfo.apiTestResult = {
      success: false,
      error: 'No API key found in environment variables',
      troubleshooting: 'Please set ANTHROPIC_API_KEY in your environment variables'
    };
  }

  // Add recommendations based on test results
  debugInfo.recommendations = generateRecommendations(debugInfo);

  res.status(200).json(debugInfo);
}

function getApiTroubleshooting(statusCode) {
  switch (statusCode) {
    case 401:
      return 'Authentication failed. Check if your API key is correct and has not expired.';
    case 403:
      return 'Access forbidden. Your API key may not have the required permissions.';
    case 429:
      return 'Rate limit exceeded. Wait a moment before trying again, or check your usage limits.';
    case 500:
      return 'Anthropic server error. This is likely temporary - try again in a few minutes.';
    case 502:
    case 503:
    case 504:
      return 'Anthropic service temporarily unavailable. Try again in a few minutes.';
    default:
      return `Unexpected status code ${statusCode}. Check Anthropic's status page for service issues.`;
  }
}

function generateRecommendations(debugInfo) {
  const recommendations = [];

  if (!debugInfo.apiKey.exists) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Missing API Key',
      solution: 'Set the ANTHROPIC_API_KEY environment variable with your valid API key'
    });
  } else if (!debugInfo.apiKey.hasCorrectPrefix) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Invalid API Key Format',
      solution: 'Ensure your API key starts with "sk-ant-api03-" and is from the correct Anthropic Console'
    });
  }

  if (debugInfo.apiTestResult && !debugInfo.apiTestResult.success) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'API Connection Failed',
      solution: debugInfo.apiTestResult.troubleshooting || 'Check your internet connection and API key'
    });
  }

  if (debugInfo.performanceTest && debugInfo.performanceTest.success && 
      parseInt(debugInfo.performanceTest.responseTime) > 5000) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Slow API Response',
      solution: 'Consider reducing max_tokens or checking your network connection'
    });
  }

  if (debugInfo.environment !== 'production' && debugInfo.apiTestResult?.success) {
    recommendations.push({
      priority: 'LOW',
      issue: 'Development Environment',
      solution: 'Remember to set production environment variables when deploying'
    });
  }

  if (recommendations.length === 0 && debugInfo.apiTestResult?.success) {
    recommendations.push({
      priority: 'INFO',
      issue: 'All Systems Operational',
      solution: 'Your AI enhancement system is ready to process bank statements!'
    });
  }

  return recommendations;
}
