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

    const prompt = `You are an AI research assistant helping a product manager turn raw customer conversations into defensible product opportunities.

First, identify 3-8 recurring themes across the entire dataset (short name + 1-sentence description).

Then extract 3-8 distinct product OPPORTUNITIES. Frame each opportunity as a customer problem the product could solve — never as a feature request or solution. Prefer titles like "Enterprise security & governance gaps", "Fragmented workflows across existing tools", or "Slow team onboarding" over "Add SSO", "Build integrations", or "Onboarding wizard".

For each opportunity provide:
- title: 3-8 words, problem framing, no vendor or technology names
- problem: 2-3 sentences. Explain what customers are struggling with, the recurring behaviour behind the grouping (what customers keep doing or working around), and why this represents a business problem worth solving. Read like a paragraph in an analyst memo — not a summary sentence.
- customer_demand: 0-100, weighted by how many conversations support this and how strongly they express it
- business_impact: low | medium | high | critical — how much this affects customers' ability to succeed with the product
- business_impact_rationale: 1 sentence naming what breaks or what's blocked, in plain business language
- confidence: 0-100, based on sample size and consistency of the signal
- confidence_rationale: 1 sentence explaining why the confidence is what it is (sample size, consistency, any gaps)
- recurring_themes: 1-3 theme names from the themes list
- evidence_indices: array of [N] indices that directly support this opportunity
- representative_quote_index: the single [N] index that best captures this opportunity in the customer's own words

Rules:
- Every AI field is an inference the PM will scrutinize — be honest about confidence, don't inflate weak signals.
- Do NOT estimate engineering effort, strategic importance, or revenue — those are the PM's job.
- Keep ALL language — titles, problem, rationales, themes — generic and portfolio-safe. This is strict and applies to every text field, not just titles.
  - NEVER name specific vendors, products, or brands (e.g. Okta, Auth0, Azure AD, Google, Microsoft, Samsung, Apple, Slack, Jira, Salesforce, Zoom, Figma, Notion, GitHub, GitLab, Jenkins, AWS, Datadog, Zendesk, HubSpot, Stripe, Linear).
  - NEVER name specific protocols, certifications, or acronyms (e.g. SSO, SAML, SCIM, OAuth, OIDC, LDAP, SOC 2, SOC2, HIPAA, GDPR, ISO 27001, PCI). Say "federated login", "automated user provisioning", "standard security certification", "regulatory compliance" instead.
  - NEVER name specific device categories, operating systems, or form factors (e.g. Android, iOS, iPhone, foldable, tablet, desktop). Say "the devices customers use" or "newer hardware form factors".
  - NEVER name specific engineering tooling (e.g. CI/CD product names, crash-log products, video-recording products). Say "our CI/CD pipeline", "diagnostic data", "usage recordings".
  - When customer feedback quotes a specific vendor/protocol/device, generalize it in your paraphrase — don't repeat the name.
- Skip pure noise; not every item must be clustered.
- Order opportunities by customer_demand descending — the highest-ranked should read like business blockers, the lowest-ranked like optimizations.

Feedback:
${numbered}`;

    try {
      const { output } = await generateText({
        model,
        prompt,
        output: Output.object({ schema: OpportunitySchema }),
      });
      return { ...sanitizeResult(output), feedback: data.feedback.map(scrub) };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = OpportunitySchema.parse(JSON.parse(error.text ?? "{}"));
          return { ...sanitizeResult(parsed), feedback: data.feedback.map(scrub) };
        } catch {
          throw new Error("AI returned malformed output. Try again.");
        }
      }
      throw error;
    }
  });

// Deterministic post-processing: strip vendor / protocol / device / tooling
// names from every AI-authored text field so the demo stays portfolio-safe
// even if the model slips a brand into its rationale.
const VENDOR_REPLACEMENTS: [RegExp, string][] = [
  // Literal line-level replacements requested for demo/uploaded quotes
  [/Need SSO with Okta before rollout\./gi, "Need single sign-on support before rollout."],
  [/SOC2 compliance is blocking procurement\./gi, "Security certification is blocking procurement."],
  [/Need more Android devices for testing\./gi, "Need more devices for testing."],
  [/Latest Samsung devices unavailable\./gi, "Latest flagship devices unavailable."],
  [/Need foldable Android devices\./gi, "Need newer device form factors."],
  [/Need GitHub Actions integration\./gi, "Need CI pipeline integration."],
  [/Jenkins pipeline support is missing\./gi, "Native build pipeline support is missing."],
  // Fixes for garbled grammar produced by earlier find-and-replace passes
  [/Need SCIM provisioning for enterprise users\./gi, "Need automated user provisioning for enterprise users."],
  [/Need automated user provisioning provisioning for enterprise users\./gi, "Need automated user provisioning for enterprise users."],
  [/More Android versions would help QA\./gi, "Broader OS version coverage would help our QA team."],
  [/More the devices customers use versions would help QA\./gi, "Broader OS version coverage would help our QA team."],
  [/Need simultaneous iOS and Android testing\./gi, "Need to test across multiple device types at the same time."],
  [/Need simultaneous the devices customers use and the devices customers use testing\./gi, "Need to test across multiple device types at the same time."],
  [/Slack notifications after test runs would help\./gi, "Sending test result notifications into the tools our team already uses would help."],
  [/the tools their team already uses notifications after test runs would help\./gi, "Sending test result notifications into the tools our team already uses would help."],
  // Identity / auth vendors
  [/\b(?:Okta|Auth0|OneLogin|Ping\s*Identity|Azure\s*AD|Entra\s*ID|Active\s*Directory|JumpCloud)\b/gi, "a supported identity provider"],
  // Collaboration / SaaS brands
  [/\b(?:Slack|Microsoft\s*Teams|MS\s*Teams|Jira|Confluence|Asana|Trello|Monday\.com|ClickUp|Notion|Figma|Miro|Zoom|Salesforce|HubSpot|Zendesk|Intercom|Linear|Stripe|Shopify)\b/gi, "the tools their team already uses"],
  // Cloud / infra brands
  [/\b(?:AWS|Amazon\s*Web\s*Services|Azure|GCP|Google\s*Cloud|Cloudflare|Datadog|Splunk|New\s*Relic|PagerDuty)\b/gi, "their existing infrastructure"],
  // Dev tooling brands
  [/\b(?:GitHub(?:\s*Actions)?|GitLab(?:\s*CI)?|Bitbucket|Jenkins(?:\s*pipeline)?|CircleCI|Travis\s*CI|Buildkite)\b/gi, "their CI/CD pipeline"],
  // Device / OS / form factor
  [/\b(?:Samsung|Apple\s*iPhone|iPhone|iPad|Pixel|Galaxy)\b/gi, "the latest consumer hardware"],
  [/\bfoldable(?:\s+Android)?\s+(?:devices?|phones?)\b/gi, "newer hardware form factors"],
  [/\bAndroid(?:\s+devices?)?\b/gi, "the devices customers use"],
  [/\biOS(?:\s+devices?)?\b/gi, "the devices customers use"],
  // Diagnostic terminology
  [/\bcrash\s+logs?\b/gi, "diagnostic data"],
  [/\bvideo\s+recordings?\b/gi, "usage recordings"],
  [/\bsession\s+logs?\b/gi, "diagnostic data"],
  [/\b(?:device|session)\s+(?:startup|allocation)\s+(?:time)?\b/gi, "environment setup time"],
  // Protocols & certifications
  [/\bSAML\s*(?:2\.0)?\b/gi, "federated login"],
  [/\bSSO\b/gi, "federated login"],
  [/\bSCIM\b/gi, "automated user provisioning"],
  [/\bLDAP\b/gi, "directory-based access"],
  [/\bOAuth\s*(?:2\.0)?\b/gi, "standards-based auth"],
  [/\bOIDC\b/gi, "standards-based auth"],
  [/\bSOC\s*2(?:\s*Type\s*II?)?\b/gi, "standard security certification"],
  [/\b(?:HIPAA|GDPR|PCI(?:\s*DSS)?|ISO\s*27001|FedRAMP)\b/gi, "regulatory compliance"],
];

function scrub(text: string): string {
  let out = text;
  for (const [pattern, replacement] of VENDOR_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Collapse duplicated-adjacent replacements ("a supported identity provider and a supported identity provider")
  out = out.replace(/\b(a supported identity provider)(?:\s+(?:and|or|,)\s+\1)+/gi, "$1");
  return out.replace(/\s{2,}/g, " ").trim();
}

function sanitizeResult<T extends ClusterResult>(r: T): T {
  return {
    ...r,
    themes: r.themes.map((t) => ({ ...t, name: scrub(t.name), description: scrub(t.description) })),
    opportunities: r.opportunities.map((o) => ({
      ...o,
      title: scrub(o.title),
      problem: scrub(o.problem),
      business_impact_rationale: scrub(o.business_impact_rationale),
      confidence_rationale: scrub(o.confidence_rationale),
      recurring_themes: o.recurring_themes.map(scrub),
    })),
  };
}

