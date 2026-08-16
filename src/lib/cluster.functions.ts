import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyzeFeedback } from "./cluster-engine";
import { scrub, sanitizeResult } from "./sanitize";

export type { ClusterResult, Opportunity, Theme } from "./cluster-engine";

const InputSchema = z.object({
  feedback: z.array(z.string()).min(1),
});

export const clusterFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const result = analyzeFeedback(data.feedback);
    return { ...sanitizeResult(result), feedback: data.feedback.map(scrub) };
  });
