// Deterministic, fully local clustering engine.
//
// Prism previously called a hosted LLM to cluster feedback. That dependency is
// gone: this module groups feedback with a keyword/affinity model, so the
// prototype runs with no external AI provider and no API keys, and produces the
// exact same result shape the UI already renders.

export type BusinessImpact = "low" | "medium" | "high" | "critical";

export type Theme = { name: string; description: string };

export type Opportunity = {
  title: string;
  problem: string;
  customer_demand: number;
  business_impact: BusinessImpact;
  business_impact_rationale: string;
  confidence: number;
  confidence_rationale: string;
  recurring_themes: string[];
  evidence_indices: number[];
  representative_quote_index: number;
};

export type ClusterResult = { themes: Theme[]; opportunities: Opportunity[] };

type ClusterSpec = {
  theme: Theme;
  title: string;
  behaviour: string;
  stake: string;
  impact: BusinessImpact;
  impactRationale: string;
  keywords: string[];
};

// Ordered by how strongly enterprise SaaS teams tend to feel each problem.
const CLUSTERS: ClusterSpec[] = [
  {
    theme: {
      name: "Enterprise security & governance",
      description:
        "Access, provisioning and administrative control expectations that larger organizations treat as prerequisites.",
    },
    title: "Enterprise security & governance gaps",
    behaviour:
      "customers keep routing access decisions through manual admin work and internal exceptions",
    stake:
      "rollouts stall in pilot because security and IT cannot approve the tool at company scale",
    impact: "critical",
    impactRationale:
      "Expansion is blocked until access and administrative controls satisfy internal review.",
    keywords: [
      "security",
      "identity",
      "login",
      "provision",
      "permission",
      "admin",
      "role",
      "access",
      "compliance",
      "legal",
      "approver",
      "it ",
      "shadow",
    ],
  },
  {
    theme: {
      name: "Fragmented workflows",
      description:
        "Work spread across several tools, forcing teams to move status and context by hand.",
    },
    title: "Fragmented workflows across existing tools",
    behaviour:
      "teams copy status between this product and the tools they already work in, and invent local workarounds",
    stake:
      "handoffs slip and the product is treated as a secondary place to check rather than a system of record",
    impact: "high",
    impactRationale:
      "Duplicate status keeping erodes trust in the data teams are supposed to act on.",
    keywords: [
      "integration",
      "integrate",
      "sync",
      "webhook",
      "api",
      "rate limit",
      "workaround",
      "propagate",
      "handoff",
      "tracker",
      "other tools",
    ],
  },
  {
    theme: {
      name: "Manual operational work",
      description: "Repeatable processes that teams still run by hand every week or quarter.",
    },
    title: "Repetitive operational work done by hand",
    behaviour:
      "the same sequence of tasks is recreated manually on a recurring cadence, often in side channels",
    stake: "team capacity is spent on coordination instead of the work the product is bought for",
    impact: "high",
    impactRationale: "Recurring manual effort scales linearly with headcount and process count.",
    keywords: [
      "repetitive",
      "repeat",
      "manual",
      "automat",
      "workflow",
      "recurring",
      "approval",
      "quarterly",
      "by hand",
      "dms",
    ],
  },
  {
    theme: {
      name: "Reporting & audit trails",
      description:
        "Evidence leadership and compliance reviewers need, in a form they can inspect directly.",
    },
    title: "Reporting leadership and auditors can trust",
    behaviour:
      "reporting ends outside the product — exports, spreadsheets and slides rebuilt for every review",
    stake:
      "leadership visibility and compliance renewals depend on artifacts assembled manually each cycle",
    impact: "high",
    impactRationale:
      "Missing audit history and rollups surface directly in procurement and renewal reviews.",
    keywords: [
      "report",
      "dashboard",
      "audit",
      "export",
      "bi tool",
      "executive",
      "leadership",
      "certification",
      "monitoring stack",
      "tenancy",
      "deployment",
      "rollup",
    ],
  },
  {
    theme: {
      name: "Onboarding & activation",
      description: "How quickly a new team or admin reaches a working setup without hand-holding.",
    },
    title: "Slow team onboarding and activation",
    behaviour:
      "internal documentation and repeated walkthroughs substitute for guidance inside the product",
    stake: "each new team loses roughly a week before the product produces value",
    impact: "medium",
    impactRationale: "Slow activation delays the point where new teams see value and stay.",
    keywords: [
      "onboard",
      "new hire",
      "empty-state",
      "empty state",
      "setup",
      "wizard",
      "template",
      "guided",
      "teach",
      "docs",
    ],
  },
  {
    theme: {
      name: "Reliability & findability",
      description:
        "Whether the product holds up under real collaboration and keeps past work retrievable.",
    },
    title: "Confidence in reliability under real usage",
    behaviour:
      "people move important work elsewhere after losing changes or failing to find earlier decisions",
    stake: "trust in the product as a durable record erodes faster than features can restore it",
    impact: "high",
    impactRationale: "Lost work and unfindable history push critical work out of the product.",
    keywords: [
      "real-time",
      "real time",
      "collaborat",
      "vanish",
      "drop",
      "incident",
      "search",
      "offline",
      "connection",
      "progress",
      "slow",
      "performance",
    ],
  },
];

const NOISE_HINTS = ["love", "pricing", "steep", "nice but", "diagnostic information"];

function scoreFor(text: string, spec: ClusterSpec): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const keyword of spec.keywords) {
    if (lower.includes(keyword)) score += 1;
  }
  return score;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Group feedback into problem-framed opportunities using deterministic keyword
 * affinity. Same input always yields the same output.
 */
export function analyzeFeedback(feedback: string[]): ClusterResult {
  const buckets = CLUSTERS.map(() => [] as number[]);

  feedback.forEach((entry, index) => {
    const lower = entry.toLowerCase();
    if (NOISE_HINTS.some((hint) => lower.includes(hint))) return;

    let bestIndex = -1;
    let bestScore = 0;
    CLUSTERS.forEach((spec, i) => {
      const score = scoreFor(entry, spec);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });
    if (bestIndex >= 0) buckets[bestIndex]!.push(index);
  });

  const total = Math.max(1, feedback.length);

  const opportunities: Opportunity[] = CLUSTERS.map((spec, i) => ({ spec, indices: buckets[i]! }))
    .filter(({ indices }) => indices.length >= 2)
    .map(({ spec, indices }) => {
      const share = indices.length / total;
      const impactWeight = { low: 0, medium: 6, high: 12, critical: 18 }[spec.impact];
      const customer_demand = Math.round(clamp(share * 160 + impactWeight, 12, 97));
      const confidence = Math.round(clamp(38 + indices.length * 7, 35, 92));
      const longest = indices.reduce(
        (best, index) => (feedback[index]!.length > feedback[best]!.length ? index : best),
        indices[0]!,
      );

      return {
        title: spec.title,
        problem: `${indices.length} of ${feedback.length} conversations point at the same friction: ${spec.behaviour}. The recurring behaviour is consistent enough to treat as a pattern rather than isolated requests. Left unaddressed, ${spec.stake}.`,
        customer_demand,
        business_impact: spec.impact,
        business_impact_rationale: spec.impactRationale,
        confidence,
        confidence_rationale:
          indices.length >= 6
            ? `Supported by ${indices.length} conversations expressing the problem in consistent language.`
            : `Supported by ${indices.length} conversations — a clear signal, though the sample is still small.`,
        recurring_themes: [spec.theme.name],
        evidence_indices: indices,
        representative_quote_index: longest,
      };
    })
    .sort((a, b) => b.customer_demand - a.customer_demand);

  const usedThemes = new Set(opportunities.flatMap((o) => o.recurring_themes));
  const themes = CLUSTERS.map((c) => c.theme).filter((t) => usedThemes.has(t.name));

  return { themes, opportunities };
}
