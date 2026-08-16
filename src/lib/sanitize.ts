import type { ClusterResult } from "./cluster-engine";

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

export function scrub(text: string): string {
  let out = text;
  for (const [pattern, replacement] of VENDOR_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Collapse duplicated-adjacent replacements ("a supported identity provider and a supported identity provider")
  out = out.replace(/\b(a supported identity provider)(?:\s+(?:and|or|,)\s+\1)+/gi, "$1");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function sanitizeResult<T extends ClusterResult>(r: T): T {
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

