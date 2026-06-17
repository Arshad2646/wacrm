import type { ChatPrompt } from './prompt';

export type AiProviderName = 'gemini' | 'openai';

export interface AiResponse {
  provider: AiProviderName;
  model: string;
  text: string;
}

function providerName(): AiProviderName {
  const raw = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (raw === 'gemini' || raw === 'openai') return raw;
  throw new Error("AI_PROVIDER must be either 'gemini' or 'openai'.");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `AI provider request failed (${response.status}): ${text.slice(0, 500)}`
    );
  }
  return JSON.parse(text) as unknown;
}

async function generateWithOpenAI(prompt: ChatPrompt): Promise<AiResponse> {
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
  const baseUrl = trimTrailingSlash(
    process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
  );

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.2,
    }),
  });

  const data = (await parseJsonResponse(response)) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI returned an empty response.');

  return { provider: 'openai', model, text };
}

async function generateWithGemini(prompt: ChatPrompt): Promise<AiResponse> {
  const apiKey = requiredEnv('GEMINI_API_KEY');
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const baseUrl = trimTrailingSlash(
    process.env.GEMINI_BASE_URL?.trim() ||
      'https://generativelanguage.googleapis.com/v1beta'
  );
  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: prompt.system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt.user }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const data = (await parseJsonResponse(response)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned an empty response.');

  return { provider: 'gemini', model, text };
}

export async function generateAiResponse(
  prompt: ChatPrompt
): Promise<AiResponse> {
  const provider = providerName();
  if (provider === 'openai') return generateWithOpenAI(prompt);
  return generateWithGemini(prompt);
}
