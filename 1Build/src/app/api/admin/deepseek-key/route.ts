import { promises as fs } from "fs";
import path from "path";
import { getDeepSeekApiKey } from "@/lib/llm";

const KEY_FILE = path.resolve(/* turbopackIgnore: true */ process.cwd(), "data/deepseek-key.json");

/**
 * GET /api/admin/deepseek-key
 * Check if a DeepSeek API key is configured (does not return the actual key).
 */
export async function GET() {
  const apiKey = getDeepSeekApiKey();
  if (apiKey) {
    const masked = apiKey.slice(0, 6) + "..." + apiKey.slice(-4);
    const fromEnv = !!process.env.DEEPSEEK_API_KEY;
    return Response.json({ configured: true, masked, fromEnv });
  }
  return Response.json({ configured: false, masked: null });
}

/**
 * POST /api/admin/deepseek-key
 * Save the DeepSeek API key to a local file.
 * Note: on Vercel, the key should be set as an environment variable instead.
 */
export async function POST(request: Request) {
  // If running with an env var set, don't allow overwriting via UI
  if (process.env.DEEPSEEK_API_KEY) {
    return Response.json(
      { error: "API key is managed via environment variable on this deployment. Update it in Vercel dashboard." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { apiKey } = body as { apiKey: string };

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return Response.json({ error: "API key is required" }, { status: 400 });
    }

    const dir = path.dirname(KEY_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(KEY_FILE, JSON.stringify({ apiKey: apiKey.trim() }, null, 2), "utf-8");

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save API key";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/deepseek-key
 * Remove the saved DeepSeek API key.
 */
export async function DELETE() {
  if (process.env.DEEPSEEK_API_KEY) {
    return Response.json(
      { error: "API key is managed via environment variable. Remove it from Vercel dashboard." },
      { status: 400 }
    );
  }
  try {
    await fs.unlink(KEY_FILE);
  } catch {
    // File didn't exist — that's fine
  }
  return Response.json({ success: true });
}
