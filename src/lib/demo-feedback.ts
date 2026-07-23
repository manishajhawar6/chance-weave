// Synthetic demo feedback for a generic B2B SaaS collaboration and workflow
// platform. Deliberately vendor-neutral — no product names, technologies, or
// vertical-specific jargon — so the AI clustering has plausible signal to
// work with while the demo remains portfolio-safe.
//
// The dataset is tuned to produce ~6 problem-framed opportunity areas when
// clustered, matching common enterprise SaaS themes:
//   1. Enterprise security & governance gaps
//   2. Fragmented workflows across the tools teams already use
//   3. Manual, repeatable operational work
//   4. Reporting & audit trails leadership can trust
//   5. Slow team onboarding
//   6. Platform reliability under real usage
//
// Entries are short, first-person, and written to sound like real customer
// interview snippets or ticket paraphrases — observations and lived pain,
// not requirement statements. Signals are mixed with unrelated noise so
// clustering has real work to do.

export const DEMO_FEEDBACK: string[] = [
  // 1 — Enterprise security & governance gaps
  "Security won't sign off until logins tie back to our identity provider. We've been stuck in pilot for a quarter.",
  "It's difficult to justify a broader rollout while IT still considers this a shadow tool.",
  "Adding four hundred people by hand isn't something we're willing to do. Provisioning has to be automated.",
  "When people leave the company, their access here doesn't disappear on its own. Compliance flagged this on the last review.",
  "Every workspace admin can see everything today. That's not something our legal team is comfortable with at our size.",
  "Our admins spend hours managing permissions one person at a time. It doesn't feel like a tool built for a company of our size.",
  "Custom roles would help — the built-in ones don't map to how our org actually works.",
  "Admin changes should require a second approver. Right now one person can quietly grant themselves the keys.",

  // 2 — Fragmented workflows across existing tools
  "Every team has created their own workaround. People copy statuses between here and the tools they actually live in.",
  "Our teams already run in other tools. What we need is clean integration points, not another place to check.",
  "Handoffs still fall through the cracks because updates don't propagate. It's not one tool's fault, but this is where it shows up.",
  "Webhooks would let us wire this into our internal tooling. Polling every minute is not a serious integration story.",
  "A two-way sync with our project tracker would remove an entire weekly ritual we do by hand.",
  "The rate limits on the API make automation fragile at our scale. Something enterprise-tier would help.",

  // 3 — Manual, repeatable operational work
  "So much of what our team does here is repetitive. It feels like the product is watching us do the same thing every week.",
  "Every quarterly review kicks off the same twenty tasks. Automating that sequence would give each lead a full day back.",
  "Cross-team handoffs still happen in DMs. If we could codify the workflow, nothing would slip.",
  "We keep rebuilding the same recurring process by hand. A workflow builder would pay for itself in a month.",
  "Approvals are the slowest part of any process we run in here — mostly because they happen out-of-band.",

  // 4 — Reporting & audit trails leadership can trust
  "The default dashboards don't answer the questions leadership actually asks in the review.",
  "Our reporting workflow ends with exporting data and rebuilding everything in a BI tool. That shouldn't be necessary.",
  "Scheduled reports emailed weekly would replace a manual process our ops team runs every Monday.",
  "Executives want a single-page rollup and there's no way to build one today. So we build it in a slide.",
  "Our larger customers require a full audit trail — who did what, when, from where — going back at least a year.",
  "Our security review flagged the missing compliance certification. That's a hard requirement for us to renew.",
  "We'd need audit logs we can pipe into our own monitoring stack. Compliance asks every quarter and we've got nothing to show them.",
  "For our regulated workloads we'd need a dedicated deployment. Shared tenancy is a dealbreaker for our legal team.",

  // 5 — Slow team onboarding
  "Our onboarding process is still mostly manual. New hires spend a week figuring out where things live.",
  "The empty-state experience for a new workspace is confusing. People genuinely don't know what to do first.",
  "We keep re-teaching the same setup steps to every new team lead. This should just be a wizard.",
  "A guided setup for admins would help — right now we write our own internal docs to onboard each team.",
  "Templates for common workspace setups would save us a week per team.",

  // 6 — Platform reliability under real usage
  "Real-time collaboration sometimes drops changes when two people edit the same section. It's hard to trust after that.",
  "We've had a couple of incidents where changes just vanished. People stopped using the doc for anything important.",
  "Search across older work is basically unusable. I know a decision was made — I can never find it again.",
  "Offline mode would be amazing. I travel a lot and lose progress every time the connection drops.",

  // Positive & unrelated noise (should not over-cluster)
  "I genuinely love the product overall — the day-to-day feel is really clean and fast.",
  "Pricing feels a little steep for smaller teams, but I understand the value.",
  "The AI assist is nice but it occasionally invents references. I'd rather it not cite than cite something fake.",
  "Better diagnostic information when something goes wrong would help our support team close tickets faster.",
];
