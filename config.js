export const config = {
  apiKey: process.env.OPENAI_API_KEY,
  apiUrl: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o-mini",
  maxTokens: 2000,
  temperature: 0.3
}; 