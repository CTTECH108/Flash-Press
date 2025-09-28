import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5000/", // Optional for tracking
    "X-Title": "FlashPress News" // App name shown in OpenRouter logs
  }
});

// ✅ Switched to DeepSeek R1 free model
const MODEL = "deepseek/deepseek-r1:free";

export async function summarizeText(text: string): Promise<string> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return `This is a demo summary of the provided text. The main points include: ${text.slice(0, 50)}... (Note: Demo mode, API key missing)`;
    }

    const prompt = `Please provide a concise summary of the following text, highlighting the key points and main ideas:\n\n${text}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500
    });

    return response.choices[0].message?.content || "Unable to generate summary";
  } catch (error: any) {
    console.error("Error summarizing text:", error);
    return `Demo Summary: The text discusses key concepts. Fallback mode. Main topic: ${text.slice(0, 100)}...`;
  }
}

export async function detectFakeNews(text: string): Promise<{
  isReal: boolean;
  confidence: number;
  reasoning: string;
}> {
  try {
    const trustedSources = ['thanthi', 'polimer', 'suntv', 'bbc', 'reuters', 'ap news'];
    const lowerText = text.toLowerCase();

    for (const source of trustedSources) {
      if (lowerText.includes(source)) {
        return {
          isReal: true,
          confidence: 0.95,
          reasoning: `Content appears to be from a trusted source: ${source}`
        };
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      const suspiciousWords = ['breaking', 'exclusive', 'shocking', 'unbelievable'];
      const hasSuspicious = suspiciousWords.some(word => lowerText.includes(word));
      return {
        isReal: !hasSuspicious,
        confidence: 0.7,
        reasoning: `Demo Analysis: Content ${hasSuspicious ? 'contains sensational language' : 'appears measured'}.`
      };
    }

    const prompt = `Analyze the following text for potential misinformation or fake news. Consider:
    - Factual accuracy
    - Source credibility
    - Emotional language
    - Consistency with known facts
    - Verifiable information
    
    Respond with a JSON object: {
      "isReal": boolean,
      "confidence": number (0-1),
      "reasoning": "detailed explanation"
    }
    
    Text: ${text}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert fact-checker. Analyze content objectively."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 700
    });

    const raw = response.choices[0].message?.content || "{}";
    let result: any = {};
    try {
      result = JSON.parse(raw);
    } catch {
      result = { isReal: false, confidence: 0.5, reasoning: raw };
    }

    return {
      isReal: result.isReal || false,
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      reasoning: result.reasoning || "Unable to analyze content"
    };
  } catch (error) {
    console.error("Error detecting fake news:", error);
    const suspiciousWords = ['breaking', 'exclusive', 'shocking', 'unbelievable'];
    const hasSuspicious = suspiciousWords.some(word => text.toLowerCase().includes(word));
    return {
      isReal: !hasSuspicious,
      confidence: 0.6,
      reasoning: `Fallback Analysis: Content ${hasSuspicious ? 'contains sensational language which may indicate misinformation' : 'appears to use measured language'}. AI analysis is temporarily unavailable.`
    };
  }
}

export async function chatWithAI(message: string, context?: string): Promise<string> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('news') || lowerMessage.includes('headline')) {
        return "Demo mode: Please check the homepage for latest headlines.";
      } else if (lowerMessage.includes('summary')) {
        return "Demo mode: Use the summarizer tool to test summaries.";
      } else {
        return "Demo mode: Hello! Try asking about news summaries or fake news detection.";
      }
    }

    let prompt = message;
    if (context) {
      prompt = `Context: ${context}\n\nUser question: ${message}`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a helpful news assistant. Summarize articles, provide insights, answer questions about current events, and be concise."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 800
    });

    return response.choices[0].message?.content || "I'm sorry, I couldn't process your request.";
  } catch (error) {
    console.error("Error in AI chat:", error);
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('news') || lowerMessage.includes('headline')) {
      return "Error mode: For the latest news, check the homepage.";
    } else if (lowerMessage.includes('summary')) {
      return "Error mode: Try the summarizer tool.";
    } else {
      return "Error mode: AI is unavailable. Please try again later.";
    }
  }
}
