// Synthetic demo feedback for a generic B2B SaaS collaboration and workflow
// platform. Deliberately vendor-neutral — no product names, technologies, or
// vertical-specific jargon — so the AI clustering has plausible signal to
// work with while the demo remains portfolio-safe.
//
// The dataset is tuned to produce ~6 opportunity themes when clustered:
//   1. Enterprise security & user management
//   2. Faster onboarding & setup for new teams
//   3. Native integrations with the tools teams already use
//   4. Automated, repeatable workflows
//   5. Better reporting & audit trails
//   6. Reliability of core collaboration
//
// Each item is short, first-person, symptom-focused. Signals are mixed with
// unrelated noise so clustering has real work to do.

export const DEMO_FEEDBACK: string[] = [
  // Enterprise security & user management
  "We can't roll this out company-wide until single sign-on works with our identity provider. Security won't sign off otherwise.",
  "Any timeline on federated login? IT paused our pilot because we can't tie accounts to our identity system.",
  "Automated user provisioning is a must — adding four hundred people by hand isn't something we're willing to do.",
  "When someone leaves the company, their access here has to disappear automatically. Right now offboarding is manual and we've missed people.",
  "Federated login plus automatic provisioning would unblock our two-hundred-seat rollout tomorrow.",
  "Our admins spend hours managing permissions one person at a time. We need group-based roles.",
  "Every workspace admin can see everything today. We need finer-grained permissions before we can expand usage.",
  "Please let us define custom roles. The built-in ones don't map to how our org actually works.",
  "Admin permission changes should require a second approver. Our compliance team keeps flagging this.",

  // Faster onboarding & setup
  "Onboarding new teams is becoming painful as we scale. New hires spend a week figuring out where things live.",
  "The empty-state experience for a new workspace is confusing. People don't know what to do first.",
  "A guided setup for admins would help — right now we write our own internal docs to onboard each new team.",
  "It takes too long to get a new team productive. There should be templates for common workspace setups.",
  "We keep re-teaching the same setup steps to every new team lead. This should just be a wizard.",

  // Native integrations with existing tools
  "Our teams already run in other tools. We just need clean integration points, not another place to check.",
  "Please add native integrations with the tools we already use daily. Copy-pasting between apps is where things fall through the cracks.",
  "Webhooks would let us integrate this with our internal tooling much more cleanly than polling every minute.",
  "Our engineering workflow tools can't post updates back into your product without a proper webhook system.",
  "The rate limits on your API are too aggressive for how we automate. Can we get an enterprise tier?",
  "We'd love a two-way sync with our project tracker so status updates propagate automatically.",

  // Automated workflows
  "So much of what our team does here is repetitive. We need a way to trigger routine actions automatically.",
  "Every quarterly review kicks off the same twenty tasks. Automating that sequence would save each lead a full day.",
  "Cross-team handoffs still happen in DMs. If we could codify the workflow, nothing would slip.",
  "We keep building the same recurring process by hand. Some kind of workflow builder would pay for itself in a month.",

  // Reporting, audit & compliance
  "Reporting isn't customizable. The default dashboards don't answer the questions leadership actually asks.",
  "We need to build our own reports with our own metrics. Right now we export data and rebuild everything in a BI tool.",
  "Scheduled reports emailed weekly would replace a manual process our ops team runs every Monday.",
  "Executives want a single-page rollup and there's no way to build one today.",
  "Our larger customers require a full audit trail — who did what, when, and from where — going back at least a year.",
  "Our security review flagged the missing compliance certification. That's a hard requirement for us to renew.",
  "Please give us audit logs we can pipe into our own monitoring stack. Compliance asks every quarter and I have nothing to show them.",
  "We'd need a dedicated deployment option for our regulated workloads. Shared tenancy is a dealbreaker for our legal team.",

  // Reliability & core collaboration
  "Real-time collaboration sometimes drops changes when two people edit the same paragraph.",
  "We've had a couple of incidents where changes just vanished. It's hard to trust the product after that.",
  "Offline mode would be amazing — I travel a lot and lose progress when my connection drops.",
  "Search across old work is basically unusable. I know a discussion happened but I can never find it again.",

  // Positive & unrelated (noise the AI should not over-cluster)
  "I genuinely love the product overall — the day-to-day feel is really clean and fast.",
  "Pricing feels a bit steep for smaller teams, but I understand the value.",
  "The AI assist is nice but it occasionally invents references. I'd rather it not cite than cite something fake.",
  "Better diagnostic information when something goes wrong would help our support team close tickets faster.",
];
