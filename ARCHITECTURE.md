# Prism — Architecture & Handover

Working documentation for the codebase in this repository, written for continuing
development **outside the Lovable editor**. Covers what the app does, how it is
wired together, and exactly which parts are coupled to Lovable.

> The root [README.md](README.md) is the original *design brief* (the prompt that
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

| Concern | Choice |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) (SSR) on React 19 |
| Router | TanStack Router, file-based (`src/routes/`) |
| Build | Vite 8 via `@lovable.dev/vite-tanstack-config` |
| Server runtime | Nitro 3 (beta), preset pinned to **Netlify** |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`) |
| Components | shadcn/ui (new-york style) + Radix primitives, in `src/components/ui/` |
| Icons | lucide-react |
| LLM | Vercel AI SDK v7 → `@ai-sdk/google` → **Google Gemini API** (direct) |
| Model | `gemini-3-flash-preview` |
| Validation | Zod v4 |
| CSV | PapaParse |
| Toasts | sonner |
| Data fetching | TanStack Query (provider mounted; the app currently calls the server fn directly) |
| Package manager | Bun (`bun.lock`, `bunfig.toml`) — but Netlify builds with `npm run build` |

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
│   ├── cluster.functions.ts   ⭐ Server function: the LLM call, schema, prompt, scrubber
│   ├── ai-provider.server.ts  Google Gemini provider factory + model id
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

Shown while the real request is in flight. The animation is **scripted, not live** —
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

## 5. The AI pipeline

`clusterFeedback` in [src/lib/cluster.functions.ts](src/lib/cluster.functions.ts) is a
TanStack Start **server function** (`createServerFn({ method: "POST" })`) — it runs on
the server only, so the API key is never shipped to the browser.

**Steps:**

1. Validate input — `z.object({ feedback: z.array(z.string()).min(1) })`
2. Read `process.env.GOOGLE_GENERATIVE_AI_API_KEY` (throws with a setup hint if absent)
3. Number and truncate each item: `[i] <text>`, whitespace collapsed, **500 chars max**
4. `generateText` with `Output.object({ schema: OpportunitySchema })` for structured output
5. On `NoObjectGeneratedError`, retry once by `JSON.parse`-ing the raw text; if that
   also fails → `"AI returned malformed output. Try again."`
6. Run every AI-authored string **and** every input quote through `scrub()`
7. Return `{ themes, opportunities, feedback }`

**Output schema** — 3-8 themes, plus 3-8 opportunities each carrying:
`title`, `problem`, `customer_demand` (0-100), `business_impact`
(low/medium/high/critical), `business_impact_rationale`, `confidence` (0-100),
`confidence_rationale`, `recurring_themes`, `evidence_indices[]`, and
`representative_quote_index` — the indices being what links an opportunity back to
the original rows.

### The prompt

A long instruction block enforcing two things that matter to the product:

- **Problem framing, never solutions** — "Enterprise security & governance gaps",
  not "Add SSO".
- **Portfolio-safe language** — no vendor names, protocols, certifications, device
  categories, or tooling brands anywhere in the output.

It also explicitly forbids the model from estimating effort, strategic importance,
or revenue ("those are the PM's job"), which is the product principle encoded in
the prompt itself.

### The scrubber

Because the model still leaks brand names occasionally, `scrub()` applies a
deterministic regex pass (`VENDOR_REPLACEMENTS`) over every text field: identity
vendors → "a supported identity provider", SSO → "federated login", SOC 2 →
"standard security certification", Android/iOS → "the devices customers use", and
so on.

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

Rendered by `PriorityLadder` as stacked rungs so the PM can *see* their own judgment
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

**Required environment variable:** `GOOGLE_GENERATIVE_AI_API_KEY` (get one at
<https://aistudio.google.com/apikey>). Without it the app boots and the landing page
renders, but clustering throws. Copy `.env.example` → `.env` and fill it in; `.env`
is gitignored.

**Netlify** ([netlify.toml](netlify.toml)): build `npm run build`, publish `dist`,
Node 20. The `netlify` Nitro preset emits an SSR function under
`.netlify/functions-internal/` which Netlify auto-detects. `GOOGLE_GENERATIVE_AI_API_KEY`
must be set in Site settings → Environment variables.

Note the mismatch: the repo carries `bun.lock` (and `bunfig.toml` pins a 24-hour
supply-chain guard, `minimumReleaseAge`), but Netlify and the README both use npm.
Pick one and commit its lockfile — running `npm install` against a repo with only
`bun.lock` re-resolves the whole tree.

---

## 10. Leaving Lovable

This project was generated by [Lovable](https://lovable.dev) (project
`db1cc8af-25e2-49ef-8151-8bd800798dc2`). Below is every coupling, and what it costs
to leave. **Only one is a genuine blocker.**

| Coupling | Where | Verdict |
| --- | --- | --- |
| ~~**AI gateway + API key**~~ | ~~`ai-gateway.server.ts`~~ | ✅ **Done.** Replaced with Google Gemini direct (`ai-provider.server.ts`). Same model id, no gateway. |
| **Build config** | `vite.config.ts` → `@lovable.dev/vite-tanstack-config` | 🟡 Public on npm (pinned 2.13.1, latest 2.14.0), so it keeps building. But it's an opaque bundle of plugins — TanStack devtools, tanstackStart, viteReact, tailwindcss, tsConfigPaths, Nitro, env injection, `@` alias, dedupe, sandbox detection. Inlining it is a chunk of work. |
| **Error telemetry** | `lovable-error-reporting.ts`, called in `__root.tsx` | 🟢 Inert outside the editor — every call is optional-chained against `window.__lovableEvents` / `window.__lovableReportRuntimeError`, which only exist in the Lovable preview. Delete or repoint at your own error tracker. |
| **`AGENTS.md`** | root | 🟢 Only says "don't rewrite published git history because it desyncs Lovable." Once detached, that constraint is void. |
| **`.lovable/`** | root | 🟢 Editor metadata (`project.json` template revision) plus one saved plan doc. Safe to delete. |
| **`bunfig.toml` excludes** | root | 🟢 `minimumReleaseAgeExcludes` lists six `@lovable.dev/*` packages. Prune to whichever you still install. |
| **Nitro preset** | `vite.config.ts` | 🟢 Already pinned to `netlify` for self-hosting; the comment notes Lovable's sandbox overrides it to Cloudflare via `LOVABLE_NITRO_PRESET`. Outside the sandbox, Netlify wins — nothing to change. |

### Suggested order of operations

1. **Replace the AI gateway first** — this is the only thing that actually breaks.
   `ai-gateway.server.ts` is 12 lines and returns an AI SDK provider, so swapping in
   Anthropic (`@ai-sdk/anthropic`), OpenAI, or Google Gemini directly is a
   one-file change plus a new model id in `cluster.functions.ts`. Keep
   `supportsStructuredOutputs` behavior in mind — the comment there warns that
   without it, `Output.object` validation fails against free-form JSON.
2. **Verify a clean build off-platform** — `npm install && npm run build` with no
   Lovable env vars present, then deploy to Netlify with the new provider key.
3. **Settle the package manager** — bun or npm, and commit the matching lockfile.
4. **Then clean up cosmetics** — drop `.lovable/`, `AGENTS.md`, the
   `lovable-error-reporting.ts` call in `__root.tsx`, and the unused `bunfig.toml`
   excludes.
5. **Optionally un-vendor the build config** — replace
   `@lovable.dev/vite-tanstack-config` with an explicit plugin list. Do this last;
   it's the highest-risk step and buys the least. The file's own header warns that
   re-adding those plugins manually breaks the app with duplicates, so port them
   deliberately rather than additively.
6. **Rewrite `README.md`** — it is currently the generation prompt, which will
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
