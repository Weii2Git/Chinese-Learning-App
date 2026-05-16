import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * POST /api/admin/test-key
 * Test the saved Gemini API key with detailed diagnostics.
 */
export async function POST() {
  try {
    // Read the saved key
    const keyFile = resolve(/* turbopackIgnore: true */ process.cwd(), "data/gemini-key.json");
    let apiKey: string | null = process.env.GEMINI_API_KEY || null;

    if (!apiKey && existsSync(keyFile)) {
      const content = readFileSync(keyFile, "utf-8");
      const parsed = JSON.parse(content);
      apiKey = parsed.apiKey || null;
    }

    if (!apiKey) {
      return Response.json(
        { success: false, error: "No API key configured" },
        { status: 400 }
      );
    }

    // Diagnostic info
    const diagnostics = {
      keyLength: apiKey.length,
      keyPrefix: apiKey.slice(0, 8),
      httpProxy: process.env.HTTP_PROXY || process.env.http_proxy || "none",
      httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || "none",
      noProxy: process.env.NO_PROXY || process.env.no_proxy || "none",
      nodeVersion: process.version,
    };

    // Try direct HTTP call
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
      const directRes = await fetch(url);
      
      if (!directRes.ok) {
        const errText = await directRes.text();
        return Response.json({
          success: false,
          error: `API call failed (${directRes.status})`,
          diagnostics,
          detail: errText.slice(0, 500),
        });
      }

      // Direct call works — now try generateContent
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Say hello in one word.",
      });

      return Response.json({
        success: true,
        message: `API key works! Response: "${response.text?.trim().slice(0, 50)}"`,
        diagnostics,
      });
    } catch (fetchError: unknown) {
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return Response.json({
        success: false,
        error: `Network error: ${msg}`,
        diagnostics,
        hint: "If you're behind a corporate proxy, the server may not be able to reach Google's API. Try running the app from a non-corporate network.",
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
