import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5000/",
    "X-Title": "FlashPress News"
  }
});

const MODEL = "mistralai/mistral-7b-instruct:free";

// Robust content extractor
function extractContent(msg: any): string {
  if (!msg) return "";
  // String content
  if (typeof msg.content === "string") return msg.content.trim();
  // Array of strings or objects
  if (Array.isArray(msg.content)) {
    let textArr: string[] = [];
    msg.content.forEach((c: string | { text?: string }) => {
      if (typeof c === "string") textArr.push(c.trim());
      else if (c?.text) textArr.push(c.text.trim());
    });
    return textArr.join(" ").trim();
  }
  // Nested text field
  if (msg.content?.[0]?.text) return msg.content[0].text.trim();
  return "";
}

// Retry wrapper for rate limits
async function callOpenAI(messages: any[], retries = 3): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) return "Demo mode: API key not configured";

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: 800
      });
      const msg = resp.choices?.[0]?.message;
      const content = extractContent(msg);
      if (content) return content;
    } catch (err: any) {
      if (err.status === 429) {
        console.warn(`Rate limit hit, retry #${attempt + 1}`);
        await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
        continue;
      }
      console.error("Error calling OpenAI:", err);
      break;
    }
  }
  return "AI temporarily unavailable. Demo mode enabled.";
}

// Summarizer
export async function summarizeText(text: string): Promise<string> {
  const prompt = `Summarize the following text concisely and clearly, highlighting key points:\n\n${text}`;
  const result = await callOpenAI([{ role: "user", content: prompt }]);
  if (!result || result.includes("Demo mode")) {
    return `Demo summary: ${text.slice(0, 150)}... (API temporarily unavailable)`;
  }
  return result;
}

// Fake news detection
export async function detectFakeNews(text: string): Promise<{ isReal: boolean; confidence: number; reasoning: string }> {
  const trustedSources = ['thanthi', 'polimer', 'suntv', 'bbc', 'reuters', 'ap news'];
  const lowerText = text.toLowerCase();

  for (const source of trustedSources) {
    if (lowerText.includes(source)) {
      return { isReal: true, confidence: 0.95, reasoning: `Content appears to be from a trusted source: ${source}` };
    }
  }

  const prompt = `Analyze the text for potential misinformation or fake news. Respond with JSON: {"isReal": boolean, "confidence": number, "reasoning": string}\n\nText: ${text}`;
  const raw = await callOpenAI([
    { role: "system", content: "You are a fact-checker chatbot." },
    { role: "user", content: prompt }
  ]);

  try {
    const result = JSON.parse(raw);
    return {
      isReal: result.isReal ?? false,
      confidence: Math.max(0, Math.min(1, result.confidence ?? 0.5)),
      reasoning: result.reasoning ?? "Unable to analyze content"
    };
  } catch {
    return { isReal: false, confidence: 0.5, reasoning: `Demo analysis: AI unavailable. Text snippet: ${text.slice(0, 100)}...` };
  }
}

// Chat AI
export async function chatWithAI(message: string, context?: string): Promise<string> {
  let prompt = message;
  if (context) prompt = `Context: ${context}\nUser question: ${message}`;
  const result = await callOpenAI([
    { role: "system", content: "You are a helpful news assistant chatbot. Answer concisely." },
    { role: "user", content: prompt }
  ]);

  if (!result || result.includes("Demo mode")) {
    return `Hello! I'm your FlashPress News assistant in demo mode. You asked: "${message}". API temporarily unavailable. Tip: check multiple news sources before trusting news.`;
  }

  return result;
}
