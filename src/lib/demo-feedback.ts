// Synthetic demo feedback — used when the PM clicks "Try with sample data".
// Industry-neutral enterprise software domain: identity, admin, search,
// reporting, audit, integrations. Deliberately mixes clear signals with
// unrelated asks so the AI clustering has real work to do.

export const DEMO_FEEDBACK: string[] = [
  // Enterprise identity management
  "We can't roll this out company-wide until you support enterprise SSO. Security won't approve otherwise.",
  "Any timeline on SAML with our enterprise identity provider? IT blocked the pilot because we can't federate logins.",
  "Automated user provisioning is a must — manually adding 400 users through your admin panel is a non-starter for us.",
  "We need our identity provider to deprovision users automatically when they leave. Right now offboarding is manual and risky.",
  "Enterprise SSO plus automated provisioning would unblock our 200-seat rollout tomorrow.",
  // Admin permission management
  "Our admins spend hours managing permissions one user at a time. We need group-based roles.",
  "Right now every workspace admin can see everything. We need granular role-based permissions before we can expand usage.",
  "Please let us define custom roles. The three built-in ones don't map to how our org actually works.",
  "Admin permission changes should require approval from a second admin. Compliance keeps flagging this.",
  // Historical decisions & search
  "Teams cannot find historical decisions. We know a discussion happened but nobody can locate it later.",
  "Search across old threads is basically unusable — I can never find a decision I remember making.",
  "The search doesn't index attachments or PDFs, which is exactly where our decision records live.",
  "Fuzzy search please. If I misspell one word I get zero results and give up.",
  "Can you add filters to search? Filtering by author, workspace, and date range would save hours every week.",
  // Reporting & analytics
  "Reporting isn't customizable. The default dashboards don't answer the questions leadership actually asks.",
  "We need to build our own reports with our own metrics. Right now we export CSVs and rebuild everything in a BI tool.",
  "Scheduled reports emailed weekly would replace a manual process our ops team does every Monday.",
  "Executives want a single-page rollup and there's no way to build one today.",
  // Audit history & compliance
  "Large customers require full audit history — who did what, when, and from where — going back at least a year.",
  "Our infosec review flagged the lack of SOC 2 Type II. That's a hard requirement for us to renew.",
  "Please add audit logs I can export to our SIEM. Compliance asks every quarter and I have nothing to show them.",
  "We'd need a private deployment option for our regulated workloads. Multi-tenant is a dealbreaker for legal.",
  // Onboarding
  "User onboarding is becoming difficult as we scale. New hires spend a week figuring out where things live.",
  "The empty-state experience for a new workspace is confusing. People don't know what to do first.",
  "Guided setup for admins would help — right now we write our own internal docs to onboard each new team.",
  // Integrations, API, misc
  "The API rate limits are too aggressive for our automation. Can we get an enterprise tier?",
  "Webhooks would let us integrate with our internal tooling much more cleanly than polling every minute.",
  "Our CI/CD tooling can't post updates back into your product without a proper webhook system.",
  "Existing engineering workflows already run in our own tools — we just need clean integration points, not another UI.",
  // Positive & unrelated
  "I love the product overall — the writing experience is really clean and fast.",
  "Pricing feels a bit steep for smaller teams but I understand the value.",
  "Real-time collaboration sometimes drops changes when two people edit the same paragraph.",
  "Offline mode would be amazing — I travel a lot and lose progress when the connection drops.",
  "AI writing assist is nice but it occasionally invents references. I'd rather it not cite than cite something fake.",
  "Diagnostic information from failed exports would help our support team resolve tickets faster.",
];
