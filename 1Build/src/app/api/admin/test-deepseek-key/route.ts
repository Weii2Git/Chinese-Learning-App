import { complete } from "@/lib/llm";

/**
 * POST /api/admin/test-deepseek-key
 * Test the saved DeepSeek API key with a tiny generation call.
 */
export async function POST() {
  try {
    const text = await complete("Say hello in one word.", { provider: "deepseek" });
    return Response.json({
      success: true,
      message: `API key works! Response: "${text.trim().slice(0, 50)}"`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = message.includes("API key not found")
      ? "Save a DeepSeek API key first."
      : "Check the key is valid and your account has credit at platform.deepseek.com.";
    return Response.json({ success: false, error: message, hint });
  }
}
