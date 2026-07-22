import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  feedback: z.array(z.string()).min(1),
});

const OpportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      theme: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      score: z.number(),
      evidence_indices: z.array(z.number()),
    }),
  ),
});

export type Opportunity = z.infer<typeof OpportunitySchema>["opportunities"][number];

export const clusterFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const numbered = data.feedback
      .map((f, i) => `[${i}] ${f.replace(/\s+/g, " ").slice(0, 500)}`)
      .join("\n");

    const prompt = `You are a product manager analyzing raw customer feedback. Cluster the feedback below into distinct product opportunities (problems or requests). For each opportunity:
- title: short punchy label (max 8 words)
- summary: 1-2 sentence description of the user problem or ask
- theme: one of "Bug", "Feature Request", "UX", "Performance", "Pricing", "Onboarding", "Integration", "Other"
- severity: low | medium | high | critical (impact on users)
- score: 0-100 priority score based on frequency * severity
- evidence_indices: array of the [N] indices from the input that support this cluster

Return between 3 and 10 opportunities, ranked by score descending. Every feedback item must belong to at most one cluster; skip noise.

Feedback:
${numbered}`;

    try {
      const { experimental_output } = await generateText({
        model,
        prompt,
        experimental_output: Output.object({ schema: OpportunitySchema }),
      });
      const sorted = [...experimental_output.opportunities].sort((a, b) => b.score - a.score);
      return { opportunities: sorted, feedback: data.feedback };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = OpportunitySchema.parse(JSON.parse(error.text ?? "{}"));
          return { opportunities: parsed.opportunities, feedback: data.feedback };
        } catch {
          throw new Error("AI returned malformed output. Try again.");
        }
      }
      throw error;
    }
  });
