import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Bot,
  User as UserIcon,
  Check,
  
  Quote,
  Layers,
  TrendingUp,
  Users,
  Target,
  ShieldCheck,
  Rocket,
  Search,
  Eye,
  Pause,
  Play,
  FileText,


} from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  clusterFeedback,
  type ClusterResult,
  type Opportunity,
} from "@/lib/cluster.functions";
import { DEMO_FEEDBACK } from "@/lib/demo-feedback";
import { DecisionSummaryDialog } from "@/components/decision-summary";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prism — Turn customer conversations into confident product decisions" },
      {
        name: "description",
        content:
          "Prism turns scattered customer conversations into clear product opportunities, evidence-backed reasoning, and confident prioritization decisions.",
      },
      {
        property: "og:title",
        content: "Prism — Turn customer conversations into confident product decisions",
      },
      {
        property: "og:description",
        content:
          "AI reads customer conversations, surfaces opportunities with evidence, and hands the decision to the PM. Built for product managers who own the call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Prism — Confident product decisions from customer conversations" },
      {
        name: "twitter:description",
        content:
          "Scattered feedback → AI reasoning → clear opportunities → confident prioritization. AI synthesizes; the PM decides.",
      },
    ],
  }),
  component: Home,
});

// ---------- Types ----------

type Decision = "prioritize" | "investigate" | "monitor" | "not_now";

type PMInput = {
  engineering_effort?: number; // 1-10 (story points-ish)
  strategic_importance?: number; // 1-5
  revenue_opportunity?: string; // optional free text ($ or note)
};

type Screen =
  | { kind: "upload" }
  | { kind: "processing"; feedback: string[] }
  | { kind: "opportunities"; result: ClusterResult & { feedback: string[] } }
  | { kind: "compare"; result: ClusterResult & { feedback: string[] }; indices: number[] }
  | { kind: "detail"; result: ClusterResult & { feedback: string[] }; index: number };

// ---------- Root ----------

function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: "upload" });
  const [pm, setPm] = useState<Record<number, PMInput>>({});
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const cluster = useServerFn(clusterFeedback);

  const runCluster = useCallback(
    async (rows: string[]) => {
      setScreen({ kind: "processing", feedback: rows });
      setPm({});
      setDecisions({});
      try {
        const result = await cluster({ data: { feedback: rows } });
        setScreen({ kind: "opportunities", result });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "AI analysis failed.");
        setScreen({ kind: "upload" });
      }
    },
    [cluster],
  );

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string> | string[]>(text, {
          header: true,
          skipEmptyLines: true,
        });
        let rows: string[] = [];
        if (
          parsed.data.length &&
          typeof parsed.data[0] === "object" &&
          !Array.isArray(parsed.data[0])
        ) {
          const objects = parsed.data as Record<string, string>[];
          const keys = Object.keys(objects[0] ?? {});
          const key =
            keys.find((k) =>
              /feedback|comment|review|message|text|content|verbatim/i.test(k),
            ) ?? keys[0];
          rows = objects
            .map((r) => (key ? r[key] : Object.values(r).join(" ")))
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
        } else {
          const arrays = parsed.data as string[][];
          rows = arrays.flat().filter((v) => typeof v === "string" && v.trim().length > 0);
        }
        if (rows.length === 0) {
          toast.error("No feedback rows found in that CSV.");
          return;
        }
        if (rows.length > 200) rows = rows.slice(0, 200);
        await runCluster(rows);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to read CSV.");
      }
    },
    [runCluster],
  );

  const handleDemo = useCallback(() => {
    void runCluster(DEMO_FEEDBACK);
  }, [runCluster]);

  return (
    <div className="prism-canvas min-h-screen text-foreground antialiased">
      <Toaster position="top-center" richColors />
      <FlowStepper screen={screen} />
      {screen.kind === "upload" && <UploadScreen onFile={handleFile} onDemo={handleDemo} />}
      {screen.kind === "processing" && <ProcessingScreen feedback={screen.feedback} />}
      {screen.kind === "opportunities" && (
        <OpportunitiesScreen
          result={screen.result}
          pm={pm}
          setPm={setPm}
          decisions={decisions}
          onCompare={(indices) =>
            setScreen({ kind: "compare", result: screen.result, indices })
          }
          onOpen={(index) => setScreen({ kind: "detail", result: screen.result, index })}
          onReset={() => setScreen({ kind: "upload" })}
        />
      )}
      {screen.kind === "compare" && (
        <CompareScreen
          result={screen.result}
          indices={screen.indices}
          pm={pm}
          setPm={setPm}
          decisions={decisions}
          onOpen={(index) => setScreen({ kind: "detail", result: screen.result, index })}
          onBack={() => setScreen({ kind: "opportunities", result: screen.result })}
        />
      )}
      {screen.kind === "detail" && (
        <DetailScreen
          result={screen.result}
          index={screen.index}
          pm={pm[screen.index]}
          setPm={(next) => setPm((prev) => ({ ...prev, [screen.index]: next }))}
          decision={decisions[screen.index]}
          onDecide={(d) => {
            setDecisions((prev) => ({ ...prev, [screen.index]: d }));
            toast.success(`Decision saved: ${DECISION_META[d].label}`);
          }}
          onBack={() => setScreen({ kind: "opportunities", result: screen.result })}
        />
      )}
    </div>
  );
}

// ---------- Shared meta ----------

const DECISION_META: Record<
  Decision,
  { label: string; blurb: string; icon: typeof Rocket; tone: string }
> = {
  prioritize: {
    label: "Prioritize This Quarter",
    blurb: "Commit to shipping this in the current quarter.",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: Rocket,
  },
  investigate: {
    label: "Investigate Further",
    blurb: "Talk to users, size the impact, refine the ask.",
    tone: "bg-primary/10 text-primary border-primary/30",
    icon: Search,
  },
  monitor: {
    label: "Monitor",
    blurb: "Not now — track whether it grows.",
    tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Eye,
  },
  not_now: {
    label: "Not Now",
    blurb: "Off-strategy or too costly for the return.",
    tone: "bg-muted text-muted-foreground border-border",
    icon: Pause,
  },
};

const IMPACT_TONE: Record<Opportunity["business_impact"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STEP_ORDER: {
  kinds: Screen["kind"][];
  label: string;
  question: string;
}[] = [
  { kinds: ["upload"], label: "Evidence", question: "What evidence do I want to analyze?" },
  { kinds: ["processing"], label: "Patterns", question: "What patterns is AI discovering?" },
  {
    kinds: ["opportunities", "compare"],
    label: "Opportunities",
    question: "What opportunities are emerging?",
  },
  { kinds: ["detail"], label: "Why it matters", question: "Why does this opportunity matter?" },
];

function PrismMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("h-5 w-5", className)}
    >
      <defs>
        <linearGradient id="prism-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M12 3 L21 20 H3 Z"
        fill="none"
        stroke="url(#prism-mark)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 3 L12 20"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlowStepper({ screen }: { screen: Screen }) {
  const activeIndex = STEP_ORDER.findIndex((s) => s.kinds.includes(screen.kind));
  const active = STEP_ORDER[activeIndex];
  return (
    <div className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3.5 text-xs">
        <div className="flex items-center gap-2.5">
          <PrismMark className="h-5 w-5 text-primary" />
          <span className="text-[15px] font-semibold tracking-tight">Prism</span>
          <span className="hidden text-muted-foreground/70 sm:inline">·</span>
          <span className="hidden text-[11px] font-medium tracking-wide text-muted-foreground sm:inline">
            <span className="text-primary/80">AI synthesizes.</span>{" "}
            <span className="text-amber-600 dark:text-amber-400">You decide.</span>
          </span>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          {STEP_ORDER.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-1.5 w-1.5 rounded-full transition-colors",
                  i < activeIndex && "bg-primary/60",
                  i === activeIndex && "bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
                  i > activeIndex && "bg-muted-foreground/25",
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-medium tracking-wide transition-colors",
                  i === activeIndex ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {s.label}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <div className="mx-1 h-px w-5 bg-border/80" />
              )}
            </div>
          ))}
        </div>
        {active && (
          <div className="w-full text-muted-foreground md:hidden">
            <span className="font-medium text-foreground">{active.label}:</span>{" "}
            {active.question}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Screen 1: Upload ----------

function UploadScreen({
  onFile,
  onDemo,
}: {
  onFile: (f: File) => void;
  onDemo: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="mx-auto max-w-5xl px-6 pb-32">
      {/* 1 — Hero */}
      <section className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center py-24 text-center">
        <h1 className="text-balance text-[52px] font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          Turn customer conversations
          <br className="hidden sm:block" />{" "}
          into <span className="text-primary">confident</span> product decisions.
        </h1>
        <p className="mt-8 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
          Prism reads scattered customer conversations, surfaces the opportunities inside, and
          hands you the evidence to prioritize with conviction.
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onDemo} size="lg" className="h-12 px-6 text-base shadow-elevate-2">
            <Play className="mr-2 h-4 w-4" />
            Run demo
          </Button>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onFile(file);
            }}
            className={cn(
              "inline-flex h-12 cursor-pointer items-center justify-center rounded-md border bg-transparent px-6 text-base font-medium transition-colors",
              dragging
                ? "border-primary/60 bg-primary/[0.04] text-primary"
                : "border-border hover:border-foreground/30",
            )}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Auto-detects the feedback column · First 200 rows · ~15s analysis
        </p>
      </section>

      {/* 2 — AI reasoning animation */}
      <section className="border-t border-border/50 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            How Prism thinks
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Evidence in. Reasoning out.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Every opportunity carries the trail it was built from — customer voices, recurring
            patterns, and the rationale behind the recommendation.
          </p>
        </div>
        <div className="mt-12">
          <AIReasoningPipeline stage="opportunity" />
        </div>
      </section>

      {/* 3 — Workspace preview */}
      <section className="border-t border-border/50 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            The workspace
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Opportunities you can defend in a roadmap review.
          </h2>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 shadow-elevate-3">
          <WorkspacePreview />
        </div>
      </section>

      {/* 4 — Philosophy */}
      <section className="border-t border-border/50 py-32 text-center">
        <p className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="text-primary">AI synthesizes.</span>{" "}
          <span className="text-foreground">You decide.</span>
        </p>
        <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
          Prism never makes the roadmap call. It hands you the evidence, the patterns, and the
          rationale — then steps back.
        </p>
      </section>

      {/* 5 — Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 py-10 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <PrismMark className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Prism</span>
          <span>— Confident product decisions from customer conversations.</span>
        </div>
        <span>Built for product managers.</span>
      </footer>
    </div>
  );
}

// A static, non-interactive snapshot of what the workspace looks like after analysis.
function WorkspacePreview() {
  const rows = [
    { title: "Enterprise readiness", demand: 92, impact: "critical" as const, priority: 87 },
    { title: "Mobile reliability", demand: 74, impact: "high" as const, priority: 62 },
    { title: "Search improvements", demand: 51, impact: "medium" as const, priority: 38 },
  ];
  return (
    <div className="text-[13px]">
      <div className="grid grid-cols-[minmax(0,2fr)_140px_110px_90px] items-center gap-4 border-b border-border/60 bg-muted/20 px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <div>Opportunity</div>
        <div>Demand</div>
        <div>Impact</div>
        <div className="text-right">Priority</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.title}
          className={cn(
            "grid grid-cols-[minmax(0,2fr)_140px_110px_90px] items-center gap-4 px-6 py-4",
            i < rows.length - 1 && "border-b border-border/40",
          )}
        >
          <div className="font-medium">{r.title}</div>
          <MeterCell value={r.demand} />
          <div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                IMPACT_TONE[r.impact],
              )}
            >
              {r.impact}
            </span>
          </div>
          <div className="text-right text-lg font-semibold tabular-nums">{r.priority}</div>
        </div>
      ))}
    </div>
  );
}



// ---------- Screen 2: Processing (live signal clustering) ----------

// The AI request is running in the background; this screen visualises the metaphor:
// individual signal tokens appear, then get grouped and named into an opportunity.
// Each step reveals one customer's words. After a group's customers are shown, the
// AI "pauses" and then resolves a pattern name — mirroring a reasoning trace.
const CLUSTER_DEMO: {
  name: string;
  customers: { id: number; quote: string }[];
}[] = [
  {
    name: "Enterprise Readiness",
    customers: [
      { id: 1, quote: "Need SSO" },
      { id: 7, quote: "Need Okta" },
      { id: 15, quote: "Need SCIM" },
      { id: 31, quote: "Need SOC 2" },
    ],
  },
  {
    name: "Mobile Reliability",
    customers: [
      { id: 4, quote: "iOS keeps crashing" },
      { id: 12, quote: "Android is way behind" },
      { id: 22, quote: "Push notifications never arrive" },
    ],
  },
  {
    name: "Search Improvements",
    customers: [
      { id: 6, quote: "Search misses PDFs" },
      { id: 18, quote: "No fuzzy match for typos" },
      { id: 27, quote: "Need better filters" },
    ],
  },
];

type StageState = "queued" | "revealing" | "pausing" | "named";
function stageAt(groupIdx: number, tick: number): { state: StageState; shown: number } {
  let offset = 0;
  for (let i = 0; i < groupIdx; i++) {
    offset += CLUSTER_DEMO[i].customers.length + 2; // customers + pause + name
  }
  const local = tick - offset;
  const size = CLUSTER_DEMO[groupIdx].customers.length;
  if (local <= 0) return { state: "queued", shown: 0 };
  if (local <= size) return { state: "revealing", shown: local };
  if (local === size + 1) return { state: "pausing", shown: size };
  return { state: "named", shown: size };
}

function ProcessingScreen({ feedback }: { feedback: string[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 850);
    return () => clearInterval(t);
  }, []);

  const activeGroup = CLUSTER_DEMO.findIndex((_, gi) => {
    const s = stageAt(gi, tick);
    return s.state !== "named";
  });
  const pipelineStage: "evidence" | "patterns" | "opportunity" | "decision" =
    activeGroup === -1
      ? "opportunity"
      : (() => {
          const s = stageAt(activeGroup, tick);
          if (s.state === "revealing") return "evidence";
          if (s.state === "pausing") return "patterns";
          return "opportunity";
        })();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
        Watch AI think
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        <span className="text-shimmer">What patterns is AI discovering?</span>
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Reading {feedback.length} customer conversations. Individual voices arrive, cluster into
        patterns, and resolve into opportunities. You'll make the call from there.
      </p>

      <AIReasoningPipeline stage={pipelineStage} className="mt-8" />

      <div className="mt-10 space-y-6">
        {CLUSTER_DEMO.map((group, gi) => {
          const { state, shown } = stageAt(gi, tick);
          const named = state === "named";
          const pausing = state === "pausing";
          const revealing = state === "revealing";
          const active = revealing || pausing;

          return (
            <Card
              key={group.name}
              className={cn(
                "border p-5 transition-all duration-500",
                named
                  ? "border-primary/40 bg-primary/[0.04] shadow-elevate-2 -translate-y-0.5"
                  : active
                    ? "border-border/80 shadow-elevate-1"
                    : "border-border/40 bg-muted/20 opacity-60",
              )}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
                {named ? (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Pattern identified
                  </span>
                ) : active ? (
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    Listening to customers
                  </span>
                ) : (
                  <span className="text-muted-foreground">Queued</span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {group.customers.slice(0, shown).map((c, idx) => (
                  <div
                    key={c.id}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className="animate-prism-merge flex items-start gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-sm shadow-elevate-1"
                  >
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                      Customer {c.id}
                    </span>
                    <span className="text-foreground">{c.quote}</span>
                    <span className="ml-auto text-muted-foreground/40">→</span>
                  </div>
                ))}
                {shown === 0 && !named && (
                  <div className="text-xs italic text-muted-foreground">Waiting…</div>
                )}
              </div>

              {pausing && (
                <div className="mt-4 flex items-center gap-2 text-sm italic text-muted-foreground">
                  <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                  <span className="text-shimmer font-medium">
                    These appear to describe…
                  </span>
                </div>
              )}

              {named && (
                <div className="animate-prism-lift mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-widest text-primary/80">
                    Named
                  </span>
                  <span className="text-base font-semibold text-primary">{group.name}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Bot className="h-3 w-3" />
        <span>AI synthesizes patterns from evidence · you own the final call</span>
      </p>
    </div>
  );
}

// ---------- Explainable AI Reasoning Pipeline ----------

function AIReasoningPipeline({
  stage,
  className,
}: {
  stage: "evidence" | "patterns" | "opportunity" | "decision";
  className?: string;
}) {
  const steps: {
    key: typeof stage;
    label: string;
    sub: string;
    icon: typeof Quote;
    owner: "ai" | "pm";
  }[] = [
    { key: "evidence", label: "Evidence", sub: "Customer voices", icon: Quote, owner: "ai" },
    { key: "patterns", label: "Patterns", sub: "Recurring signals", icon: Layers, owner: "ai" },
    { key: "opportunity", label: "Opportunity", sub: "With rationale", icon: Sparkles, owner: "ai" },
    { key: "decision", label: "Human decision", sub: "PM owns the call", icon: UserIcon, owner: "pm" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === stage);
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-surface/70 p-4 shadow-elevate-1 backdrop-blur",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Explainable reasoning pipeline
        </span>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">
          <span className="text-primary">AI synthesizes</span> ·{" "}
          <span className="text-amber-600 dark:text-amber-400">you decide</span>
        </span>
      </div>
      <div className="grid grid-cols-4 items-stretch gap-1.5">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          const isPm = s.owner === "pm";
          return (
            <div key={s.key} className="relative">
              <div
                className={cn(
                  "flex h-full flex-col items-start gap-1 rounded-xl border p-2.5 transition-all duration-500",
                  isActive && !isPm && "border-primary/50 bg-primary/[0.06] shadow-elevate-2 -translate-y-0.5",
                  isActive && isPm && "border-amber-500/50 bg-amber-500/[0.06]",
                  isPast && "border-primary/25 bg-primary/[0.03]",
                  !isActive && !isPast && "border-border/60 bg-transparent opacity-70",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md transition-colors",
                      isPm
                        ? isActive
                          ? "bg-amber-500 text-white"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : isActive || isPast
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary/60",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  {isActive && (
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-primary">
                      Now
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12px] font-semibold leading-tight">{s.label}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">{s.sub}</div>
              </div>
              {i < steps.length - 1 && (
                <div className="pointer-events-none absolute -right-1.5 top-1/2 z-10 hidden -translate-y-1/2 text-muted-foreground/50 sm:block">
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path
                      d="M1 5 H8 M6 2 L9 5 L6 8"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- AI/PM chips ----------

function AIChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary",
        className,
      )}
    >
      <Bot className="h-3 w-3" /> AI
    </span>
  );
}

function PMChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <UserIcon className="h-3 w-3" /> You
    </span>
  );
}

// ---------- Priority scoring ----------

function priorityBreakdown(op: Opportunity, pm?: PMInput) {
  const impactBoost: Record<Opportunity["business_impact"], number> = {
    low: 0,
    medium: 5,
    high: 12,
    critical: 20,
  };
  const ai = Math.round(
    ((op.customer_demand * op.confidence) / 100) * 0.6 + impactBoost[op.business_impact],
  );
  const strategic = pm?.strategic_importance ? pm.strategic_importance * 15 : 0;
  const effortPenalty = pm?.engineering_effort ? pm.engineering_effort * 3 : 0;
  const total = Math.max(0, ai + strategic - effortPenalty);
  return { ai, strategic, effortPenalty, total };
}

function priorityScore(op: Opportunity, pm?: PMInput) {
  return priorityBreakdown(op, pm).total;
}

// ---------- Screen 3: Opportunities ----------

function OpportunitiesScreen({
  result,
  pm,
  setPm,
  decisions,
  onCompare,
  onOpen,
  onReset,
}: {
  result: ClusterResult & { feedback: string[] };
  pm: Record<number, PMInput>;
  setPm: React.Dispatch<React.SetStateAction<Record<number, PMInput>>>;
  decisions: Record<number, Decision>;
  onCompare: (indices: number[]) => void;
  onOpen: (index: number) => void;
  onReset: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const rows = useMemo(
    () =>
      result.opportunities
        .map((op, i) => ({ op, i, priority: priorityScore(op, pm[i]) }))
        .sort((a, b) => b.priority - a.priority),
    [result.opportunities, pm],
  );

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const updatePM = (i: number, patch: Partial<PMInput>) =>
    setPm((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            What opportunities are emerging?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {result.opportunities.length} opportunities extracted from {result.feedback.length}{" "}
            feedback items. AI supplied demand, evidence, and impact; add your effort and strategic
            scores to see the final priority. Select 2+ to compare side-by-side.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <Upload className="mr-2 h-4 w-4" />
          New upload
        </Button>
      </div>

      {result.themes.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            Recurring themes
          </div>
          <AIChip>AI</AIChip>
          {result.themes.map((t) => (
            <Badge key={t.name} variant="secondary" className="text-xs" title={t.description}>
              {t.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-border/60">
        <div className="min-w-[1100px]">
          <div className="grid grid-cols-[36px_minmax(0,2.2fr)_110px_minmax(0,1.4fr)_120px_240px_180px] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div />
            <div>Opportunity</div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Demand <AIChip>AI</AIChip>
            </div>
            <div className="flex items-center gap-1">
              <Quote className="h-3 w-3" /> Evidence <AIChip>AI</AIChip>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Impact <AIChip>AI</AIChip>
            </div>
            <div className="flex items-center gap-1">
              PM Inputs <PMChip>You</PMChip>
            </div>
            <div className="text-right">Final Priority</div>
          </div>
          {rows.map(({ op, i, priority }) => {
            const decision = decisions[i];
            const pmi = pm[i] ?? {};
            const bd = priorityBreakdown(op, pmi);
            const quote = result.feedback[op.representative_quote_index];
            return (
              <div
                key={i}
                className={cn(
                  "hover-lift animate-prism-lift grid grid-cols-[36px_minmax(0,2.2fr)_110px_minmax(0,1.4fr)_120px_240px_180px] items-start gap-3 border-b border-border/60 bg-card px-4 py-3 last:border-b-0",
                  selected.has(i) && "bg-primary/5",
                )}
              >
                <Checkbox
                  checked={selected.has(i)}
                  onCheckedChange={() => toggle(i)}
                  aria-label={`Select ${op.title}`}
                  className="mt-1"
                />
                <button onClick={() => onOpen(i)} className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold hover:underline">{op.title}</span>
                    {decision && (
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                          DECISION_META[decision].tone,
                        )}
                      >
                        {DECISION_META[decision].label}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {op.problem}
                  </div>
                </button>
                <MeterCell value={op.customer_demand} />
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">
                    {op.evidence_indices.length} quote
                    {op.evidence_indices.length === 1 ? "" : "s"}
                  </div>
                  {quote && (
                    <div className="mt-1 line-clamp-2 italic">
                      "{quote.slice(0, 90)}
                      {quote.length > 90 ? "…" : ""}"
                    </div>
                  )}
                </div>
                <div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      IMPACT_TONE[op.business_impact],
                    )}
                  >
                    {op.business_impact}
                  </span>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    {Math.round(op.confidence)}% conf.
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Effort
                    </Label>
                    <NumInput
                      value={pmi.engineering_effort}
                      onChange={(v) => updatePM(i, { engineering_effort: v })}
                      min={1}
                      max={10}
                      placeholder="1-10"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Strategic
                    </Label>
                    <NumInput
                      value={pmi.strategic_importance}
                      onChange={(v) => updatePM(i, { strategic_importance: v })}
                      min={1}
                      max={5}
                      placeholder="1-5"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums">{priority}</div>
                  <div className="mt-1 flex flex-wrap justify-end gap-1 text-[10px]">
                    <span className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-primary">
                      AI {bd.ai}
                    </span>
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5",
                        bd.strategic > 0
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                          : "border-dashed border-border text-muted-foreground",
                      )}
                    >
                      + You {bd.strategic}
                    </span>
                    {bd.effortPenalty > 0 && (
                      <span className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                        − Effort {bd.effortPenalty}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Priority is not a single opaque score. It's{" "}
        <span className="text-primary">AI-inferred customer signal</span> +{" "}
        <span className="text-amber-600 dark:text-amber-400">your strategic importance</span> −{" "}
        <span className="text-amber-600 dark:text-amber-400">your engineering effort</span>. Each
        row shows the parts so you can see where the number comes from.
      </p>


      <div className="sticky bottom-4 mt-6 flex justify-center">
        <div
          className={cn(
            "flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur transition-opacity",
            selected.size === 0 && "opacity-60",
          )}
        >
          <span className="text-xs text-muted-foreground">
            {selected.size === 0
              ? "Select opportunities to compare"
              : `${selected.size} selected`}
          </span>
          <Button
            size="sm"
            disabled={selected.size < 2}
            onClick={() => onCompare([...selected].sort((a, b) => a - b))}
          >
            <Layers className="mr-2 h-4 w-4" />
            Compare side-by-side
          </Button>
        </div>
      </div>
    </div>
  );
}

function MeterCell({ value, tone = "primary" }: { value: number; tone?: "primary" | "muted" }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs font-semibold tabular-nums">{Math.round(value)}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              tone === "primary" ? "bg-primary" : "bg-muted-foreground/50",
            )}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  min: number;
  max: number;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        const n = Number(raw);
        if (Number.isNaN(n)) return;
        onChange(Math.max(min, Math.min(max, n)));
      }}
      className="h-8 border-amber-500/30 bg-amber-500/5 text-sm"
    />
  );
}

// ---------- Screen 3b: Compare ----------

function CompareScreen({
  result,
  indices,
  pm,
  setPm,
  decisions,
  onOpen,
  onBack,
}: {
  result: ClusterResult & { feedback: string[] };
  indices: number[];
  pm: Record<number, PMInput>;
  setPm: React.Dispatch<React.SetStateAction<Record<number, PMInput>>>;
  decisions: Record<number, Decision>;
  onOpen: (index: number) => void;
  onBack: () => void;
}) {
  const updatePM = (i: number, patch: Partial<PMInput>) =>
    setPm((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

  const priorities = indices.map((i) => priorityScore(result.opportunities[i], pm[i]));
  const maxPriority = Math.max(...priorities, 1);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to opportunities
      </Button>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Comparison workspace
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Comparing {indices.length} opportunities
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Two clearly-separated inputs feed the recommendation:{" "}
        <span className="text-primary">what AI inferred from customer feedback</span> and{" "}
        <span className="text-amber-600 dark:text-amber-400">what you contribute as PM</span>. The
        priority recommendation lives underneath both — never as just another column.
      </p>

      <div className="mt-8 overflow-x-auto">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `220px repeat(${indices.length}, minmax(260px, 1fr))` }}
        >
          <CompareRowLabel>Opportunity</CompareRowLabel>
          {indices.map((i) => {
            const op = result.opportunities[i];
            const dec = decisions[i];
            return (
              <div key={`h-${i}`} className="rounded-lg border border-border/60 bg-card p-4">
                <button
                  className="text-left text-base font-semibold hover:underline"
                  onClick={() => onOpen(i)}
                >
                  {op.title}
                </button>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{op.problem}</p>
                {dec && (
                  <span
                    className={cn(
                      "mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      DECISION_META[dec].tone,
                    )}
                  >
                    {DECISION_META[dec].label}
                  </span>
                )}
              </div>
            );
          })}

          {/* ============ AI SIGNALS GROUP ============ */}
          <CompareGroupHeader tone="ai" label="AI-inferred from customer feedback" columns={indices.length} />

          <CompareRowLabel tone="ai">
            <Users className="h-3.5 w-3.5" /> Customer demand
          </CompareRowLabel>
          {indices.map((i) => (
            <CompareCell key={`d-${i}`} tone="ai">
              <MeterCell value={result.opportunities[i].customer_demand} />
            </CompareCell>
          ))}

          <CompareRowLabel tone="ai">
            <TrendingUp className="h-3.5 w-3.5" /> Business impact
          </CompareRowLabel>
          {indices.map((i) => {
            const op = result.opportunities[i];
            return (
              <CompareCell key={`bi-${i}`} tone="ai">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    IMPACT_TONE[op.business_impact],
                  )}
                >
                  {op.business_impact}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">{op.business_impact_rationale}</p>
              </CompareCell>
            );
          })}

          <CompareRowLabel tone="ai">
            <Quote className="h-3.5 w-3.5" /> Supporting evidence
          </CompareRowLabel>
          {indices.map((i) => {
            const op = result.opportunities[i];
            const quote = result.feedback[op.representative_quote_index];
            return (
              <CompareCell key={`ev-${i}`} tone="ai">
                {quote && (
                  <blockquote className="border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground">
                    "{quote.slice(0, 180)}
                    {quote.length > 180 ? "…" : ""}"
                  </blockquote>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {op.evidence_indices.length} total quotes
                </p>
              </CompareCell>
            );
          })}

          <CompareRowLabel tone="ai">
            <ShieldCheck className="h-3.5 w-3.5" /> Confidence
          </CompareRowLabel>
          {indices.map((i) => {
            const op = result.opportunities[i];
            return (
              <CompareCell key={`c-${i}`} tone="ai">
                <MeterCell value={op.confidence} tone="muted" />
                <p className="mt-2 text-xs text-muted-foreground">{op.confidence_rationale}</p>
              </CompareCell>
            );
          })}

          {/* ============ PM INPUTS GROUP ============ */}
          <CompareGroupHeader tone="pm" label="Your PM inputs — why leadership should care" columns={indices.length} />

          <CompareRowLabel tone="pm">
            <Target className="h-3.5 w-3.5" /> Engineering effort
          </CompareRowLabel>
          {indices.map((i) => (
            <CompareCell key={`e-${i}`} tone="pm">
              <NumInput
                value={pm[i]?.engineering_effort}
                onChange={(v) => updatePM(i, { engineering_effort: v })}
                min={1}
                max={10}
                placeholder="1-10 (higher = more work)"
              />
            </CompareCell>
          ))}

          <CompareRowLabel tone="pm">
            <Rocket className="h-3.5 w-3.5" /> Strategic importance
          </CompareRowLabel>
          {indices.map((i) => (
            <CompareCell key={`s-${i}`} tone="pm">
              <NumInput
                value={pm[i]?.strategic_importance}
                onChange={(v) => updatePM(i, { strategic_importance: v })}
                min={1}
                max={5}
                placeholder="1-5"
              />
            </CompareCell>
          ))}

          <CompareRowLabel tone="pm">
            <TrendingUp className="h-3.5 w-3.5" /> Revenue opportunity
            <span className="ml-1 text-[10px] font-normal normal-case text-muted-foreground">
              (optional)
            </span>
          </CompareRowLabel>
          {indices.map((i) => (
            <CompareCell key={`r-${i}`} tone="pm">
              <Input
                value={pm[i]?.revenue_opportunity ?? ""}
                placeholder="e.g. $40k ARR at risk"
                onChange={(e) => updatePM(i, { revenue_opportunity: e.target.value })}
                className="h-8 border-amber-500/30 bg-amber-500/5 text-sm"
              />
            </CompareCell>
          ))}
        </div>
      </div>

      {/* ============ PRIORITY RECOMMENDATION — outcome band, distinct from column grid ============ */}
      <div className="mt-8 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-md bg-primary/20 p-2">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              Priority recommendation
            </div>
            <div className="text-xs text-muted-foreground">
              Emerges from both groups above — evidence is what carries this forward, not the
              number.
            </div>
          </div>
        </div>
        <div
          className="mt-5 grid gap-4"
          style={{ gridTemplateColumns: `220px repeat(${indices.length}, minmax(260px, 1fr))` }}
        >
          <div className="text-xs text-muted-foreground">
            AI signal + your strategic − your effort
          </div>
          {indices.map((i, k) => {
            const p = priorities[k];
            const winner = p === Math.max(...priorities) && priorities.length > 1;
            const bd = priorityBreakdown(result.opportunities[i], pm[i]);
            return (
              <div
                key={`p-${i}`}
                className={cn(
                  "rounded-lg border bg-card p-4",
                  winner ? "border-primary/60 shadow-sm" : "border-border/60",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-3xl font-semibold tabular-nums",
                      winner && "text-primary",
                    )}
                  >
                    {p}
                  </span>
                  {winner && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      top pick
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(p / maxPriority) * 100}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-primary">
                    AI {bd.ai}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5",
                      bd.strategic > 0
                        ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                        : "border-dashed border-border text-muted-foreground",
                    )}
                  >
                    + You {bd.strategic}
                  </span>
                  {bd.effortPenalty > 0 && (
                    <span className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                      − Effort {bd.effortPenalty}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <AIChip>AI</AIChip>
          <span>= inferred from customer feedback (with rationale)</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <PMChip>You</PMChip>
          <span>= entered by you; leadership signal that AI cannot infer</span>
        </div>
      </div>
    </div>
  );
}

function CompareRowLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ai" | "pm";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-3 text-xs font-semibold uppercase tracking-wider",
        tone === "ai" && "bg-primary/5 text-primary",
        tone === "pm" && "bg-amber-500/5 text-amber-600 dark:text-amber-400",
        !tone && "bg-muted/40 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

function CompareCell({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ai" | "pm";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        tone === "ai" && "border-primary/20",
        tone === "pm" && "border-amber-500/30",
        !tone && "border-border/60",
      )}
    >
      {children}
    </div>
  );
}

function CompareGroupHeader({
  tone,
  label,
  columns,
}: {
  tone: "ai" | "pm";
  label: string;
  columns: number;
}) {
  return (
    <div
      style={{ gridColumn: `1 / span ${columns + 1}` }}
      className={cn(
        "mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-widest",
        tone === "ai"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {tone === "ai" ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

// ---------- Screen 4/5: Detail + Decision ----------

function DetailScreen({
  result,
  index,
  pm,
  setPm,
  decision,
  onDecide,
  onBack,
}: {
  result: ClusterResult & { feedback: string[] };
  index: number;
  pm?: PMInput;
  setPm: (next: PMInput) => void;
  decision?: Decision;
  onDecide: (d: Decision) => void;
  onBack: () => void;
}) {
  const op = result.opportunities[index];
  const bd = priorityBreakdown(op, pm);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const evidence = useMemo(
    () =>
      op.evidence_indices
        .map((i) => ({ i, text: result.feedback[i] }))
        .filter((e): e is { i: number; text: string } => typeof e.text === "string"),
    [op, result.feedback],
  );
  const representative = evidence.find((e) => e.i === op.representative_quote_index) ?? evidence[0];
  const patch = (p: Partial<PMInput>) => setPm({ ...pm, ...p });

  const confidenceTier =
    op.confidence >= 75 ? "High" : op.confidence >= 50 ? "Moderate" : "Emerging";
  const missingPmInputs: string[] = [];
  if (!pm?.engineering_effort) missingPmInputs.push("engineering effort");
  if (!pm?.strategic_importance) missingPmInputs.push("strategic importance");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to opportunities
      </Button>

      {/* Memo header */}
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Priority brief
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{op.title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
        {op.problem}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {op.recurring_themes.map((t) => (
          <Badge key={t} variant="secondary" className="text-xs">
            <Layers className="mr-1 h-3 w-3" />
            {t}
          </Badge>
        ))}
      </div>

      {/* Section 1 — What customers are saying */}
      <MemoSection
        source="ai"
        eyebrow="Section 1 · Evidence"
        title="What customers are saying"
        lede={`${op.evidence_indices.length} customer${op.evidence_indices.length === 1 ? "" : "s"} in the analyzed feedback raised this pattern${representative ? `. One voice captures it:` : "."}`}
      >
        {representative && (
          <blockquote className="animate-prism-quote mt-3 border-l-2 border-primary/50 pl-4 text-base italic leading-relaxed text-foreground">
            "{representative.text}"
            <div className="mt-1 not-italic text-[11px] uppercase tracking-widest text-muted-foreground">
              Customer #{representative.i + 1} · representative
            </div>
          </blockquote>
        )}
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Every voice behind this pattern
          </div>
          <ScrollArea className="max-h-[280px] rounded-lg border border-border/60">
            <ul className="divide-y divide-border/60">
              {evidence.map((e, idx) => (
                <li
                  key={e.i}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className="animate-prism-merge flex gap-3 px-4 py-2.5"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    #{e.i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{e.text}</p>
                </li>
              ))}
              {evidence.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">No evidence linked.</li>
              )}
            </ul>
          </ScrollArea>
        </div>
      </MemoSection>

      {/* Section 2 — Why this matters */}
      <MemoSection
        source="ai"
        eyebrow="Section 2 · Signals"
        title="Why this matters"
        lede={op.business_impact_rationale}
      >
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize",
              IMPACT_TONE[op.business_impact],
            )}
          >
            {op.business_impact} business impact
          </span>
          <span className="text-sm text-muted-foreground">
            Customer-demand signal: <span className="font-semibold text-foreground">{Math.round(op.customer_demand)} / 100</span>
          </span>
        </div>
        <div className="mt-4">
          <Label className="text-xs">
            Revenue opportunity <span className="text-muted-foreground">(optional — why leadership should care)</span>
          </Label>
          <Input
            value={pm?.revenue_opportunity ?? ""}
            onChange={(e) => patch({ revenue_opportunity: e.target.value })}
            placeholder="e.g. $40k ARR at risk across 3 enterprise renewals"
            className="mt-1 h-9 border-amber-500/30 bg-amber-500/5 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            <PMChip>You</PMChip> <span className="ml-1">The AI can count mentions; it can't count dollars.</span>
          </p>
        </div>
      </MemoSection>

      {/* Section 3 — AI reasoning */}
      <MemoSection
        source="ai"
        eyebrow="Section 3 · AI reasoning"
        title="How AI reached this pattern"
        lede={op.confidence_rationale}
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Signal strength
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {Math.round(op.customer_demand)}
              <span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Composite of mention count and expressed intensity.
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Confidence
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {Math.round(op.confidence)}
              <span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {confidenceTier} — based on sample size and consistency.
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Recurring themes
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {op.recurring_themes.length ? (
                op.recurring_themes.map((t) => (
                  <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-muted-foreground">None linked</span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] italic text-muted-foreground">
          <Bot className="h-3 w-3 shrink-0 text-primary" />
          AI synthesizes what the evidence shows. It doesn't tell you what to do next.
        </p>
      </MemoSection>

      {/* Section 4 — Priority (blend of AI + PM inputs) */}
      <MemoSection
        source="mixed"
        eyebrow="Section 4 · Priority"
        title="What's driving this recommendation"
        lede="Priority emerges from AI-observed customer signal combined with your effort and strategic scoring — not a single opaque number."
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <PMChip>You</PMChip>
              <span className="text-xs font-semibold uppercase tracking-wider">Your inputs</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Engineering effort (1-10)</Label>
                <NumInput
                  value={pm?.engineering_effort}
                  onChange={(v) => patch({ engineering_effort: v })}
                  min={1}
                  max={10}
                  placeholder="Story-point-ish estimate"
                />
              </div>
              <div>
                <Label className="text-xs">Strategic importance (1-5)</Label>
                <NumInput
                  value={pm?.strategic_importance}
                  onChange={(v) => patch({ strategic_importance: v })}
                  min={1}
                  max={5}
                  placeholder="Alignment with company strategy"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Priority recommendation
              </span>
            </div>
            <div className="text-4xl font-semibold tabular-nums">{bd.total}</div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI customer signal</span>
                <span className="font-mono">+{bd.ai}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your strategic boost</span>
                <span className="font-mono">+{bd.strategic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effort penalty</span>
                <span className="font-mono">−{bd.effortPenalty}</span>
              </div>
            </div>
          </div>
        </div>
      </MemoSection>

      {/* Section 4 — What still needs validation */}
      <MemoSection
        source="ai"
        eyebrow="Section 5 · Open questions"
        title="What still needs validation"
        lede={op.confidence_rationale}
      >
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-semibold">{confidenceTier}</span>
            <span className="text-muted-foreground">confidence · {Math.round(op.confidence)} / 100</span>
          </span>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {op.confidence < 75 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              Validate with a broader sample before committing significant engineering.
            </li>
          )}
          {missingPmInputs.length > 0 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Add {missingPmInputs.join(" and ")} above so the priority reflects your context.
            </li>
          )}
          {op.business_impact === "critical" || op.business_impact === "high" ? (
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              Confirm the impact rationale with a customer-facing team before the roadmap meeting.
            </li>
          ) : null}
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            AI surfaces patterns from what customers wrote — silent segments won't appear here.
          </li>
        </ul>
      </MemoSection>

      {/* Section 5 — Decision */}
      <MemoSection
        source="pm"
        eyebrow="Section 6 · PM decision"
        title="Your call"
        lede="AI synthesized the evidence above. This next step is yours — pick one. You can revisit and change it anytime."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(DECISION_META) as Decision[]).map((d) => {
            const meta = DECISION_META[d];
            const Icon = meta.icon;
            const active = decision === d;
            return (
              <button
                key={d}
                onClick={() => onDecide(d)}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-4 text-left transition-all hover:border-foreground/40",
                  active ? meta.tone + " ring-2" : "border-border/60",
                )}
              >
                <Icon className="mb-2 h-5 w-5" />
                <div className="text-sm font-semibold">{meta.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{meta.blurb}</div>
              </button>
            );
          })}
        </div>
        {decision && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div>
              <p className="text-xs text-muted-foreground">
                Current decision:{" "}
                <span className="font-semibold text-foreground">
                  {DECISION_META[decision].label}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Ready for the roadmap meeting? Export a one-page summary.
              </p>
            </div>
            <Button size="sm" onClick={() => setSummaryOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Generate one-page summary
            </Button>
          </div>
        )}
      </MemoSection>

      {decision && (
        <DecisionSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          result={result}
          index={index}
          pm={pm}
          decision={decision}
        />
      )}
    </div>
  );
}

function MemoSection({
  source,
  eyebrow,
  title,
  lede,
  children,
}: {
  source: "ai" | "pm" | "mixed";
  eyebrow: string;
  title: string;
  lede: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-border/60 pt-8">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </span>
        {source === "ai" && <AIChip>AI</AIChip>}
        {source === "pm" && <PMChip>You</PMChip>}
        {source === "mixed" && (
          <>
            <AIChip>AI</AIChip>
            <span className="text-xs text-muted-foreground">+</span>
            <PMChip>You</PMChip>
          </>
        )}
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{lede}</p>
      {children}
    </section>
  );
}

function SignalCard({
  source,
  icon: Icon,
  title,
  value,
  rationale,
  children,
}: {
  source: "ai" | "pm";
  icon: typeof Users;
  title: string;
  value: string;
  rationale: string;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "border p-5",
        source === "ai" ? "border-primary/20" : "border-amber-500/30",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        {source === "ai" ? <AIChip>AI</AIChip> : <PMChip>You</PMChip>}
      </div>
      <div className="mt-3 text-lg font-semibold capitalize">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>
      <div className="mt-3">{children}</div>
    </Card>
  );
}
