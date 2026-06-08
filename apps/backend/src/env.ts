import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file if it exists (usually for local development outside docker)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters long'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // AI model names — override via env when providers rotate models, no code change needed.
  OPENAI_MODEL: z.string().default('gpt-4o'),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  // Gemini "thinking" budget for extraction calls. 0 = disabled (fastest/cheapest).
  GEMINI_THINKING_BUDGET: z.coerce.number().int().min(0).default(0),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),
  GEMINI_EMBED_DIMS: z.coerce.number().int().positive().default(768),

  // Optional: Tavily web search for up-to-date clinical context in chat.
  TAVILY_API_KEY: z.string().optional(),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment validation failed:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const env = parseResult.data;
export type Env = z.infer<typeof envSchema>;
