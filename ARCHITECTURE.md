# Prism — Architecture & Handover

Working documentation for the codebase in this repository, written for continuing
development **outside the Lovable editor**. Covers what the app does, how it is
wired together, and exactly which parts are coupled to Lovable.

> The root [README.md](README.md) is the original _design brief_ (the prompt that
> produced this app), not a description of what was built. This file is the
> description of what was built.

---

## 1. What the product is

**Prism** (called "OpportunityIQ" in the brief) is a single-page B2B SaaS demo for
product managers. It takes raw customer feedback, uses an LLM to cluster it into
recurring **product opportunities**, and then hands the prioritization decision to
the PM with the supporting evidence attached.

The governing principle, repeated throughout the UI copy: **AI synthesizes, the PM
decides.** The AI never scores strategic importance, engineering effort, or revenue
— those are PM-only inputs, and the interface visually separates AI-authored fields
(`AIChip`, primary/violet tone) from PM-authored fields (`PMChip`, neutral tone).

Everything is **in-memory and per-session**. There is no database, no auth, and no
persistence — reloading the page resets all state.

---

## 2. Tech stack

| Concern         | Choice                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| Framework       | [TanStack Start](https://tanstack.com/start) (SSR) on React 19                    |
| Router          | TanStack Router, file-based (`src/routes/`)                                       |
| Build           | Vite 8 via `@lovable.dev/vite-tanstack-config`                                    |
| Server runtime  | Nitro 3 (beta), preset pinned to **Netlify**                                      |
| Styling         | Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`)                     |
| Components      | shadcn/ui (new-york style) + Radix primitives, in `src/components/ui/`            |
| Icons           | lucide-react                                                                      |
| LLM             | Local deterministic demo pipeline — no external LLM or AI API                     |
| Model           | None — deterministic local rules                                                  |
| Validation      | Zod v4                                                                            |
| CSV             | PapaParse                                                                         |
| Toasts          | sonner                                                                            |
| Data fetching   | TanStack Query (provider mounted; the app currently calls the server fn directly) |
| Package manager | Bun (`bun.lock`, `bunfig.toml`) — but Netlify builds with `npm run build`         |

---

## 3. Directory map

```
src/
├── routes/
│   ├── __root.tsx        App shell: <html> skeleton, fonts, QueryClientProvider,
│   │                     404 + error boundary components
│   ├── index.tsx         THE APP — ~2,800 lines, all five screens (see §4)
│   ├── README.md         TanStack file-routing conventions cheat-sheet
│   └── routeTree.gen.ts  Auto-generated. Never edit by hand.
├── components/
│   ├── decision-summary.tsx   Export dialog: one-pager as text / HTML / print-to-PDF
│   └── ui/                    47 shadcn/ui primitives (mostly untouched)
├── lib/
│   ├── cluster.functions.ts   ⭐ Server function: deterministic clustering, schema, and scrubber
│   ├── demo-feedback.ts       40 synthetic customer quotes for the "Run demo" path
│   ├── error-capture.ts       Out-of-band error recorder (see §7)
│   ├── error-page.ts          Static HTML 500 page
│   ├── lovable-error-reporting.ts  Telemetry hook — Lovable-editor only
│   └── utils.ts               `cn()` (clsx + tailwind-merge)
├── router.tsx            createRouter + QueryClient
├── start.ts              Request middleware: converts uncaught throws → HTML 500
├── server.ts             SSR entry wrapper (overrides TanStack's default)
└── styles.css            Design tokens, light/dark themes, custom animations
```

Root config: `vite.config.ts`, `netlify.toml`, `components.json`, `eslint.config.js`,
`bunfig.toml`, `tsconfig.json` (path alias `@/*` → `./src/*`).

---

## 4. Application flow

The entire app is one route (`/`) driving a **discriminated-union state machine** in
`Home()` ([src/routes/index.tsx:88](src/routes/index.tsx#L88)). There is no URL
routing between screens — screen state lives in React state only.

```
type Screen =
  | { kind: "upload" }
  | { kind: "processing"; feedback: string[] }
  | { kind: "opportunities"; result: ClusterResult & { feedback: string[] } }
  | { kind: "compare";      result: ...; indices: number[] }
  | { kind: "detail";       result: ...; index: number }
```

Two pieces of state survive across screens, keyed by opportunity index:

- `pm: Record<number, PMInput>` — engineering effort (1-10), strategic importance
  (1-5), revenue opportunity (free text)
- `decisions: Record<number, Decision>` — `prioritize | investigate | monitor | not_now`

### Screen 1 — Upload (`UploadScreen`)

Marketing landing page plus the two entry points:

- **Run demo** → clusters the 40 built-in quotes from `demo-feedback.ts`
- **Upload CSV** → window-level drag-and-drop (whole page is a drop target) or file picker

CSV handling ([src/routes/index.tsx:120](src/routes/index.tsx#L120)): PapaParse with
`header: true`, then the feedback column is auto-detected by regex
(`/feedback|comment|review|message|text|content|verbatim/i`), falling back to the
first column. Headerless CSVs are flattened. **Capped at 200 rows.**

Landing sections: hero → `#how-it-works` (`SignaturePipeline`) → `#workspace`
(`WorkspacePreview`) → `#philosophy` → footer.

### Screen 2 — Processing (`ProcessingScreen`)

Shown while the local clustering pipeline is running. The animation is **scripted, not live** —
`CLUSTER_DEMO` ([src/routes/index.tsx:615](src/routes/index.tsx#L615)) is a hardcoded
three-group storyboard advanced by an 850 ms `setInterval`. Each group cycles
`queued → revealing → pausing → named` via `stageAt()`. It exists to make the wait
legible ("~15 seconds"), not to report actual model progress.

Accompanied by `AIReasoningPipeline` (Evidence → Patterns → Opportunity → Human
decision) and `LoadingNarrative` (five plain-language phases).

### Screen 3 — Opportunities (`OpportunitiesScreen`)

A dense table sorted by computed priority, descending. Each row expands inline
(`EditorialExpansion`) to reveal evidence, rationale, and the PM inputs — so the PM
can adjust effort/importance and watch the priority number re-animate without
leaving the list. Checkboxes select rows; a sticky pill enables **Compare** at 2+.

### Screen 3b — Compare (`CompareScreen`)

Side-by-side matrix, deliberately split into two labelled bands: **"Read from
customer conversations"** (AI) and the PM's own inputs. Reinforces the AI/PM
separation at the point of trade-off.

### Screen 4 — Detail (`DetailScreen`)

An opportunity rendered as a **priority memo** in six sections:

1. Evidence — representative quote + every supporting voice
2. Signals — business impact, demand, PM's revenue-opportunity field
3. AI reasoning — confidence rationale
4. Recommended priority — PM inputs plus the `PriorityLadder` breakdown
5. Open questions — what still needs validation (conditional on confidence/impact)
6. **PM decision** — the four decision buttons

Choosing a decision unlocks **Export one-pager** → `DecisionSummaryDialog`, which
builds a plain-text version (copy / download `.txt`) and a self-contained HTML page
opened in a new window for Print → Save as PDF.

---

## 5. The local clustering pipeline

`clusterFeedback` in [src/lib/cluster.functions.ts](src/lib/cluster.functions.ts) is a
TanStack Start **server function** (`createServerFn({ method: "POST" })`). It performs
the demo's clustering and opportunity synthesis without calling an external LLM or
AI provider.

The important architectural change is that Prism is now **self-contained**: there is
no Gemini dependency, no Google AI API key, and no external model invocation required
to run the product.

**Steps:**

1. Validate input — `z.object({ feedback: z.array(z.string()).min(1) })`
2. Number and truncate each item: `[i] <text>`, whitespace collapsed, **500 chars max**
3. Normalize the feedback into deterministic text features/keywords.
4. Group feedback into the predefined/local opportunity patterns used by the demo.
5. Build the structured `OpportunitySchema` output deterministically from the matched
   feedback indices.
6. Run every generated string and every input quote through `scrub()`.
7. Return `{ themes, opportunities, feedback }`.

There is no model call, retry-on-LLM-failure path, API key lookup, or external network
dependency in this pipeline.

**Output schema** — 3-8 themes, plus 3-8 opportunities each carrying:
`title`, `problem`, `customer_demand` (0-100), `business_impact`
(low/medium/high/critical), `business_impact_rationale`, `confidence` (0-100),
`confidence_rationale`, `recurring_themes`, `evidence_indices[]`, and
`representative_quote_index` — the indices being what links an opportunity back to
the original rows.

### Local opportunity rules

The prototype uses deterministic rules/patterns rather than an LLM prompt. The rules
identify recurring concepts in customer feedback and map them to portfolio-safe
problem statements and opportunity records.

This preserves the product principle:

- **Problem framing, never solutions** — "Enterprise security & governance gaps",
  not "Add SSO".
- **Portfolio-safe language** — no vendor names, protocols, certifications, device
  categories, or tooling brands in generated output.
- **AI/PM separation remains intact** — customer-derived fields are generated by the
  local pipeline, while strategic importance, engineering effort, revenue opportunity,
  and the final decision remain PM inputs.

### The scrubber

`scrub()` applies a deterministic regex pass (`VENDOR_REPLACEMENTS`) over every
generated text field and every input quote: identity vendors → "a supported identity
provider", SSO → "federated login", SOC 2 → "standard security certification",
Android/iOS → "the devices customers use", and so on.

Because there is no external model, the scrubber is now a deterministic safety and
normalization layer rather than a cleanup step for LLM output.

⚠️ **Known wart:** the top of that list contains ~13 literal sentence-level fixes
patching grammar that earlier replacement passes garbled (e.g. `"Need automated user
provisioning provisioning for enterprise users."`). They are tightly coupled to the
old demo strings and are the first thing to delete if you rework the demo dataset.

---

## 6. Priority scoring

`priorityBreakdown()` ([src/routes/index.tsx:1241](src/routes/index.tsx#L1241)) is the
one piece of business logic worth knowing by heart:

```
ai            = round((customer_demand × confidence / 100) × 0.6 + impactBoost)
                  impactBoost: low 0 · medium 5 · high 12 · critical 20
strategic     = strategic_importance × 15      (PM, 0 if unset)
effortPenalty = engineering_effort × 3          (PM, 0 if unset)

total         = max(0, ai + strategic − effortPenalty)
```

Rendered by `PriorityLadder` as stacked rungs so the PM can _see_ their own judgment
moving the number, with `useAnimatedNumber` tweening the total (easeOutCubic, 380 ms).

`suggestDecision(priority, confidence)` proposes — never applies — a decision:
`≥70 & conf ≥60` → prioritize · `≥45` → investigate · `conf <50` → monitor ·
else → not now.

---

## 7. SSR error handling

Three layers, all custom, worth understanding before touching `server.ts`:

- **`start.ts`** — request middleware wrapping every request; non-HTTP throws are
  logged and converted to the static HTML page from `error-page.ts`.
- **`server.ts`** — overrides TanStack's server entry (wired via
  `tanstackStart.server.entry` in `vite.config.ts`). It exists because **h3 swallows
  in-handler throws** into a generic `{"unhandled":true,"message":"HTTPError"}` JSON
  500 that `try/catch` never sees. `normalizeCatastrophicSsrResponse()` sniffs that
  exact body shape and swaps in the real error page.
- **`error-capture.ts`** — records the original `Error` out-of-band (5 s TTL) from
  `error`/`unhandledrejection` listeners, so the swallowed stack can be recovered.
- **`__root.tsx`** — client-side 404 and error-boundary components.

---

## 8. Design system

Defined entirely in [src/styles.css](src/styles.css) — Tailwind v4 CSS-first, no JS
config file.

- **Color** — OKLCH tokens with a full light/dark pair. Primary is violet
  (`oklch(0.52 0.22 275)` light / `oklch(0.72 0.18 275)` dark).
- **Type** — Geist + Geist Mono, loaded from Google Fonts in `__root.tsx`.
- **Elevation** — `--shadow-elevate-1/2/3` plus a `--shadow-glow` primary halo.
- **Custom utilities** — `prism-canvas` (layered radial-gradient page background),
  `text-shimmer`, and the `animate-prism-*` family: `float`, `lift`, `merge`
  (evidence rows flying in), `quote`, `pulse-ring`, `draw`.

Component conventions: `cn()` for class merging, `class-variance-authority` for
variants, `@/` alias for imports.

---

## 9. Running and deploying

```sh
npm install        # or: bun install
npm run dev        # vite dev
npm run build      # vite build → Nitro (Netlify preset)
npm run preview
npm run lint       # eslint
npm run format     # prettier
```

**Environment variables:** None are required for the clustering pipeline. Prism no
longer requires `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or
any other external AI provider key.

The application can be run and deployed with the local deterministic pipeline only.
The landing page, CSV upload, clustering, opportunity generation, prioritization,
comparison, detail views, and export flow do not depend on an external AI API.

**Netlify** ([netlify.toml](netlify.toml)): build `npm run build`, publish `dist`,
Node 20. The `netlify` Nitro preset emits an SSR function under
`.netlify/functions-internal/` which Netlify auto-detects. No Gemini/Google AI
environment variable needs to be configured in Site settings.

Note the mismatch: the repo carries `bun.lock` (and `bunfig.toml` pins a 24-hour
supply-chain guard, `minimumReleaseAge`), but Netlify and the README both use npm.
Pick one and commit its lockfile — running `npm install` against a repo with only
`bun.lock` re-resolves the whole tree.

---

## 10. Leaving Lovable

This project was generated by [Lovable](https://lovable.dev) (project
`db1cc8af-25e2-49ef-8151-8bd800798dc2`). Below is every coupling, and what it costs
to leave. **Only one is a genuine blocker.**

| Coupling                   | Where                                                  | Verdict                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI provider / API key**  | `cluster.functions.ts`                                 | 🟢 **Removed.** Clustering is deterministic and local; no external AI provider or API key is required.                                                                                                                                                                             |
| **Build config**           | `vite.config.ts` → `@lovable.dev/vite-tanstack-config` | 🟡 Public on npm (pinned 2.13.1, latest 2.14.0), so it keeps building. But it's an opaque bundle of plugins — TanStack devtools, tanstackStart, viteReact, tailwindcss, tsConfigPaths, Nitro, env injection, `@` alias, dedupe, sandbox detection. Inlining it is a chunk of work. |
| **Error telemetry**        | `lovable-error-reporting.ts`, called in `__root.tsx`   | 🟢 Inert outside the editor — every call is optional-chained against `window.__lovableEvents` / `window.__lovableReportRuntimeError`, which only exist in the Lovable preview. Delete or repoint at your own error tracker.                                                        |
| **`AGENTS.md`**            | root                                                   | 🟢 Only says "don't rewrite published git history because it desyncs Lovable." Once detached, that constraint is void.                                                                                                                                                             |
| **`.lovable/`**            | root                                                   | 🟢 Editor metadata (`project.json` template revision) plus one saved plan doc. Safe to delete.                                                                                                                                                                                     |
| **`bunfig.toml` excludes** | root                                                   | 🟢 `minimumReleaseAgeExcludes` lists six `@lovable.dev/*` packages. Prune to whichever you still install.                                                                                                                                                                          |
| **Nitro preset**           | `vite.config.ts`                                       | 🟢 Already pinned to `netlify` for self-hosting; the comment notes Lovable's sandbox overrides it to Cloudflare via `LOVABLE_NITRO_PRESET`. Outside the sandbox, Netlify wins — nothing to change.                                                                                 |

### Suggested order of operations

1. **Keep the local deterministic pipeline as the only clustering path** — there is no
   Gemini provider/server integration, Google AI SDK, model configuration, or AI provider
   environment variable. Keep `cluster.functions.ts` as the deterministic clustering
   entry point.
2. **Replace AI-dependent behavior with deterministic local rules** — preserve the
   existing `OpportunitySchema` and downstream UI contract so the five-screen
   experience does not need to change.
3. **Verify a clean build off-platform** — run `npm install && npm run build` with no
   Lovable or AI provider secrets present.
4. **Verify the complete demo flow** — test Run demo, CSV upload, processing,
   opportunities, compare, detail, PM inputs, decisions, and export.
5. **Settle the package manager** — bun or npm, and commit the matching lockfile.
6. **Then clean up cosmetics** — drop `.lovable/`, `AGENTS.md`, the
   `lovable-error-reporting.ts` call in `__root.tsx`, and unused `bunfig.toml`
   excludes if they are no longer needed.
7. **Optionally un-vendor the build config** — replace
   `@lovable.dev/vite-tanstack-config` with an explicit plugin list. Do this last;
   it's the highest-risk step and buys the least.
8. **Rewrite `README.md`** — it is currently the generation prompt, which will
   confuse the next person who clones this.

### Known rough edges worth addressing while you're in there

- `src/routes/index.tsx` is ~2,800 lines holding all five screens, the scoring
  logic, and a dozen presentational components. Splitting it per screen is the
  single highest-value refactor.
- `PMInput` and `Decision` are defined **twice** — in `index.tsx` and again in
  `decision-summary.tsx`. Extract to a shared module before they drift.
- `DECISION_META` (index.tsx) and `DECISION_LABEL` (decision-summary.tsx) duplicate
  the same four labels.
- The literal sentence replacements at the top of `VENDOR_REPLACEMENTS` (§5) are
  dead weight tied to old demo strings.
- `@typescript-eslint/no-unused-vars` is disabled in `eslint.config.js`, which is
  why `index.tsx` has blank slots in its lucide import block.
- No tests, and no test runner installed.
