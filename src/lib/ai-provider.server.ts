import { createGoogleGenerativeAI } from "@ai-sdk/google";

// The model id is unchanged from the Lovable gateway era — the gateway simply
// proxied Google's API, so calling Google directly keeps identical behavior.
export const CLUSTER_MODEL = "gemini-3-flash-preview";

/**
 * Google Generative AI provider, talking to Google directly (no gateway).
 *
 * Structured output: @ai-sdk/google maps `Output.object({ schema })` onto
 * Gemini's native responseSchema, so the JSON schema is enforced server-side.
 * The old OpenAI-compatible shim needed an explicit `supportsStructuredOutputs`
 * flag for this; the native provider does not.
 */
export function createAiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}
