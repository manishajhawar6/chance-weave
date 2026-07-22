import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  feedback: z.array(z.string()).min(1),
});

const OpportunitySchema = z.object({
  themes: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    }),
  ),
  opportunities: z.array(
    z.object({
      title: z.string(),
      problem: z.string(),
      customer_demand: z.number(),
      business_impact: z.enum(["low", "medium", "high", "critical"]),
      business_impact_rationale: z.string(),
      confidence: z.number(),
      confidence_rationale: z.string(),
      recurring_themes: z.array(z.string()),
      evidence_indices: z.array(z.number()),
      representative_quote_index: z.number(),
    }),
  ),
});

export type ClusterResult = z.infer<typeof OpportunitySchema>;
export type Opportunity = ClusterResult["opportunities"][number];
export type Theme = ClusterResult["themes"][number];

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

    const prompt = `You are an AI research assistant helping a product manager analyze raw customer feedback.

First identify 3-8 recurring themes across the entire dataset (short name + 1-sentence description).

Then extract 3-10 distinct product OPPORTUNITIES (problems or requests). For each opportunity provide:
- title: short punchy label (max 8 words)
- problem: 1-2 sentence description of the user problem or ask
- customer_demand: 0-100, based on how many feedback items support this and how strongly they express it
- business_impact: low | medium | high | critical — how much this affects customers' ability to succeed with the product
- business_impact_rationale: 1 sentence explaining the impact rating (what breaks / what's blocked)
- confidence: 0-100, how confident you are this is a real, well-supported pattern (not noise)
- confidence_rationale: 1 sentence explaining the confidence (sample size, clarity of signal, consistency)
- recurring_themes: 1-3 theme names (from the themes list you produced) that this opportunity ties into
- evidence_indices: array of [N] indices from the input that directly support this opportunity
- representative_quote_index: the single [N] index that best captures this opportunity in the customer's own words

Rules:
- Every AI field is an inference the PM will scrutinize — be honest about confidence; don't inflate weak signals.
- Do NOT estimate engineering effort, strategic importance, or revenue — those are the PM's job.
- Skip pure noise; not every item must be clustered.
- Order opportunities by customer_demand descending.

Feedback:
${numbered}`;

    try {
      const { output } = await generateText({
        model,
        prompt,
        output: Output.object({ schema: OpportunitySchema }),
      });
      return { ...output, feedback: data.feedback };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = OpportunitySchema.parse(JSON.parse(error.text ?? "{}"));
          return { ...parsed, feedback: data.feedback };
        } catch {
          throw new Error("AI returned malformed output. Try again.");
        }
      }
      throw error;
    }
  });
