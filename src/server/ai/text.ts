import { AppError } from "../errors";
import { logger } from "../logger";

/**
 * AI text generation (SF5 product descriptions, SF10 website designer). Buyer-supplied keys only, never ours:
 *   GEMINI_API_KEY        → Google Gemini (generateContent, JSON mode)
 *   OPENAI_API_KEY        → OpenAI chat completions (JSON mode)
 *   AI_API_KEY + AI_BASE_URL (AI_ENABLED=true) → any OpenAI-compatible endpoint (OpenRouter, Together, Ollama…)
 *   none                  → off; the seeded demo seller gets the deterministic mock (AI_DEMO_MOCK, default on)
 * Callers own the prompt and the mock output, so the mock stays deterministic and testable.
 */
export interface TextProvider {
  readonly name: "gemini" | "openai" | "mock";
  /** Returns the model's raw JSON text. */
  json(input: { system: string; user: string; temperature?: number }): Promise<string>;
}

type Fetch = typeof fetch;

export class GeminiText implements TextProvider {
  readonly name = "gemini" as const;
  constructor(private cfg: { apiKey: string; model: string }, private fetchImpl: Fetch = fetch) {}
  async json({ system, user, temperature = 0.6 }: { system: string; user: string; temperature?: number }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.cfg.model)}:generateContent`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      logger.error("ai.text_failed", { provider: "gemini", status: res.status });
      throw new AppError("UNAVAILABLE", "ai_failed");
    }
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  }
}

export class OpenAIText implements TextProvider {
  readonly name = "openai" as const;
  constructor(private cfg: { baseUrl: string; apiKey: string; model: string }, private fetchImpl: Fetch = fetch) {}
  async json({ system, user, temperature = 0.6 }: { system: string; user: string; temperature?: number }) {
    const res = await this.fetchImpl(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.cfg.model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      logger.error("ai.text_failed", { provider: "openai", status: res.status });
      throw new AppError("UNAVAILABLE", "ai_failed");
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  }
}

/** Marker provider: callers see name "mock" and build their own deterministic answer. */
export class MockText implements TextProvider {
  readonly name = "mock" as const;
  async json(): Promise<string> {
    return "{}";
  }
}

export type AiTextEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AI_ENABLED?: boolean;
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
};

/** Which real provider the env configures (pure). "mock" only when AI_ENABLED + AI_PROVIDER=mock. */
export function resolveTextProvider(e: AiTextEnv, fetchImpl: Fetch = fetch): TextProvider | null {
  if (e.GEMINI_API_KEY?.trim()) return new GeminiText({ apiKey: e.GEMINI_API_KEY.trim(), model: e.GEMINI_MODEL || "gemini-2.0-flash" }, fetchImpl);
  if (e.OPENAI_API_KEY?.trim())
    return new OpenAIText({ baseUrl: "https://api.openai.com/v1", apiKey: e.OPENAI_API_KEY.trim(), model: e.OPENAI_MODEL || "gpt-4o-mini" }, fetchImpl);
  if (e.AI_ENABLED && e.AI_PROVIDER === "mock") return new MockText();
  if (e.AI_ENABLED && e.AI_API_KEY?.trim())
    return new OpenAIText({ baseUrl: e.AI_BASE_URL || "https://api.openai.com/v1", apiKey: e.AI_API_KEY.trim(), model: e.AI_MODEL || "gpt-4o-mini" }, fetchImpl);
  return null;
}

/** Parse a model's JSON answer (tolerates ```json fences). */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AppError("UNAVAILABLE", "ai_bad_json");
  }
}

export const LANGUAGE_NAME: Record<string, string> = {
  ku: "Sorani Kurdish written in Arabic script",
  kmr: "Kurmanji Kurdish written in Latin script",
  ar: "Arabic (Iraqi-friendly Modern Standard)",
  en: "English",
};
