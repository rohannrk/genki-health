import axios from 'axios';
import { env } from '../env';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  apiKey: string;
  provider: AIProvider;
  model?: string;
  prompt: string;
  messages?: AIMessage[];
  /** Base64-encoded file content for vision/OCR tasks */
  imageBase64?: string;
  /** MIME type of the image (image/jpeg, image/png, application/pdf) */
  imageMimeType?: string;
  /** Ask the model to return strict JSON (no prose). */
  jsonOutput?: boolean;
  /** Enable provider "thinking"/reasoning. Defaults to false for speed/cost. */
  thinking?: boolean;
}

export interface AIServiceResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: env.OPENAI_MODEL,
  anthropic: env.ANTHROPIC_MODEL,
  gemini: env.GEMINI_MODEL,
};

async function callOpenAI(options: AICompletionOptions): Promise<AIServiceResponse> {
  const model = options.model ?? DEFAULT_MODELS.openai;
  const messages: any[] = [];

  if (options.messages) {
    for (const m of options.messages) {
      messages.push({ role: m.role, content: m.content });
    }
  }

  if (options.imageBase64 && options.imageMimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: options.prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${options.imageMimeType};base64,${options.imageBase64}`,
          },
        },
      ],
    });
  } else if (!options.messages || options.messages.length === 0) {
    messages.push({ role: 'user', content: options.prompt });
  }

  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model, messages, max_tokens: 2048 },
    { headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' } }
  );

  return {
    text: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

async function callAnthropic(options: AICompletionOptions): Promise<AIServiceResponse> {
  const model = options.model ?? DEFAULT_MODELS.anthropic;
  const messages: any[] = [];
  let systemPrompt = '';

  if (options.messages) {
    for (const m of options.messages) {
      if (m.role === 'system') {
        systemPrompt = m.content;
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  if (options.imageBase64 && options.imageMimeType) {
    const mediaType = options.imageMimeType;
    messages.push({
      role: 'user',
      content: [
        {
          type: options.imageMimeType === 'application/pdf' ? 'document' : 'image',
          source: { type: 'base64', media_type: mediaType, data: options.imageBase64 },
        },
        { type: 'text', text: options.prompt },
      ],
    });
  } else if (!options.messages || messages.length === 0) {
    messages.push({ role: 'user', content: options.prompt });
  }

  const body: any = { model, messages, max_tokens: 2048 };
  if (systemPrompt) body.system = systemPrompt;

  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    body,
    {
      headers: {
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    text: data.content[0].text,
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  };
}

async function callGemini(options: AICompletionOptions): Promise<AIServiceResponse> {
  const model = options.model ?? DEFAULT_MODELS.gemini;
  const parts: any[] = [];

  if (options.imageBase64 && options.imageMimeType) {
    parts.push({
      inline_data: { mime_type: options.imageMimeType, data: options.imageBase64 },
    });
  }

  parts.push({ text: options.prompt });

  const contents: any[] = [];
  if (options.messages) {
    for (const m of options.messages) {
      if (m.role === 'system') continue; // handled via system_instruction
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
  }
  if (contents.length === 0 || options.imageBase64) {
    contents.push({ role: 'user', parts });
  }

  const systemInstruction = options.messages?.find(m => m.role === 'system')?.content;
  const generationConfig: any = {
    // Large budget so multi-page OCR isn't truncated. Gemini 3 "thinking" tokens also
    // draw from this pool, so keep it generous.
    maxOutputTokens: 16384,
    // Disable "thinking" by default — big latency/cost win for extraction tasks.
    thinkingConfig: { thinkingBudget: options.thinking ? -1 : env.GEMINI_THINKING_BUDGET },
  };
  if (options.jsonOutput) {
    generationConfig.responseMimeType = 'application/json';
  }
  const body: any = { contents, generationConfig };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  );

  const candidate = data.candidates?.[0];
  // Join all text parts (Gemini may split output, and skip non-text "thought" parts).
  const text = (candidate?.content?.parts ?? [])
    .map((p: any) => p?.text ?? '')
    .join('')
    .trim();

  if (!text) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'unknown';
    throw new Error(`Gemini returned no text (finishReason=${reason})`);
  }

  return {
    text,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

export async function generateAICompletion(options: AICompletionOptions): Promise<AIServiceResponse> {
  switch (options.provider) {
    case 'openai':
      return callOpenAI(options);
    case 'anthropic':
      return callAnthropic(options);
    case 'gemini':
      return callGemini(options);
  }
}
