import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
    // Required: without this the gateway model ignores the JSON schema and
    // returns free-form JSON, which fails Output.object validation.
    supportsStructuredOutputs: true,
  });
}
