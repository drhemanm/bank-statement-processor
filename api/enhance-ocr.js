// ISSUE: Wrong header name
// Current code uses: "x-api-key"
// Should be: "anthropic-api-key"

// Fixed headers object:
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "anthropic-api-key": process.env.ANTHROPIC_API_KEY,  // ✅ CORRECT
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    messages: [/* ... */]
  })
});
