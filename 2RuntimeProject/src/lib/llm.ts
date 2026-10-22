import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getAppSettings } from "@/app/api/admin/settings/route";

/**
 * LLM provider abstraction.
 *
 * A single `complete(prompt)` entry point dispatches to the active provider
 * (Gemini or DeepSeek) based on admin settings. Prompt builders and response
 * parsers elsewhere in the app stay provider-agnostic: they hand a prompt in
 * and get raw text back, exactly as they did when talking to Gemini directly.
 *
 * Errors are normalized so the existing `isRateLimitError` / `isTimeoutError`
 * helpers keep working regardless of which provider produced the failure.
 */

export type LlmProvider = "gemini" | "deepseek";

const GEMINI_MODEL = "gemini-2.5-flash";
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// Gemini generation config (speed optimization — matches previous inline config)
const GEMINI_GENERATION_CONFIG = {
  thinkingConfig: { thinkingBudget: 0 },
  maxOutputTokens: 4096,
  temperature: 0.7,
};

export interface CompleteOptions {
  /** Force a specific provider instead of reading from settings (used by test-key). */
  provider?: LlmProvider;
  /** Ask the provider to return strict JSON when supported. */
  json?: boolean;
  /** Sampling temperature override. */
  temperature?: number;
}

/**
 * Read a key saved via the admin page from a local JSON file ({ "apiKey": "..." }).
 */
function readSavedKey(fileName: string): string | null {
  try {
    const keyFile = resolve(/* turbopackIgnore: true */ process.cwd(), fileName);
    if (!existsSync(keyFile)) return null;
    const content = readFileSync(keyFile, "utf-8");
    const { apiKey } = JSON.parse(content);
    return typeof apiKey === "string" && apiKey.length > 0 ? apiKey : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the Gemini API key: env var first, then admin-saved file.
 */
export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || readSavedKey("data/gemini-key.json");
}

/**
 * Resolve the DeepSeek API key: env var first, then admin-saved file.
 */
export function getDeepSeekApiKey(): string | null {
  return process.env.DEEPSEEK_API_KEY || readSavedKey("data/deepseek-key.json");
}

/**
 * Determine which provider should handle generation. Reads the admin setting,
 * defaulting to Gemini so nothing changes until the toggle is flipped.
 */
export async function getActiveProvider(): Promise<LlmProvider> {
  try {
    const settings = await getAppSettings();
    return settings.llmProvider === "deepseek" ? "deepseek" : "gemini";
  } catch {
    return "gemini";
  }
}

/**
 * Normalize a provider error so the shared rate-limit / timeout detectors
 * (which match on error message text) fire regardless of provider.
 */
function normalizeError(provider: LlmProvider, status: number | null, bodyText: string): Error {
  if (status === 429) {
    return new Error(`${provider} rate limit (429): ${bodyText.slice(0, 200)}`);
  }
  if (status === 408 || /timeout|timed out/i.test(bodyText)) {
    return new Error(`${provider} request timed out: ${bodyText.slice(0, 200)}`);
  }
  return new Error(`${provider} API error${status ? ` (${status})` : ""}: ${bodyText.slice(0, 300)}`);
}

async function completeWithGemini(prompt: string, opts: CompleteOptions): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not found. Go to /admin to configure your API key.");
  }
  const client = new GoogleGenAI({ apiKey });
  const config = {
    ...GEMINI_GENERATION_CONFIG,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.json ? { responseMimeType: "application/json" } : {}),
  };
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config,
  });
  const text = response.text;
  if (!text) {
    throw new Error("Gemini API returned an empty response");
  }
  return text;
}

async function completeWithDeepSeek(prompt: string, opts: CompleteOptions): Promise<string> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error("DeepSeek API key not found. Go to /admin to configure your API key.");
  }

  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: opts.temperature ?? 0.7,
    max_tokens: 4096,
    stream: false,
  };
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network-level failure (DNS, connection reset, abort). Surface as timeout-ish.
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`deepseek request failed (network): ${msg}`);
  }

  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      /* ignore */
    }
    throw normalizeError("deepseek", res.status, bodyText);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("DeepSeek API returned an empty response");
  }
  return text;
}

/**
 * Generate a completion from the active (or forced) LLM provider.
 * Returns raw model text for existing parsers to handle.
 */
export async function complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
  const provider = opts.provider ?? (await getActiveProvider());
  if (provider === "deepseek") {
    return completeWithDeepSeek(prompt, opts);
  }
  return completeWithGemini(prompt, opts);
}
