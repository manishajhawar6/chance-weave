import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type Theme,
} from "@/lib/cluster.functions";
import { DEMO_FEEDBACK } from "@/lib/demo-feedback";
import { DecisionSummaryDialog } from "@/components/decision-summary";
import { PriorityInfo, DemoNotice } from "@/components/priority-explainer";

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
        toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
          toast.error("No feedback rows in that CSV.");
          return;
        }
        if (rows.length > 200) rows = rows.slice(0, 200);
        await runCluster(rows);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Couldn't read that CSV.");
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
            toast.success(`Saved · ${DECISION_META[d].label}`);
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
  const isHome = screen.kind === "upload";
  const homeLinks = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#workspace", label: "Workspace" },
    { href: "#philosophy", label: "Philosophy" },
  ];
  return (
    <div className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3.5 text-xs">
        <div className="flex items-center gap-2.5">
          <PrismMark className="h-5 w-5 text-primary" />
          <span className="text-[15px] font-semibold tracking-tight">Prism</span>
          <span className="hidden text-muted-foreground/70 sm:inline">·</span>
          <span className="hidden text-[11px] font-medium tracking-wide text-muted-foreground sm:inline">
            <span className="text-primary/80">AI synthesizes.</span>{" "}
            <span className="text-foreground/80">You decide.</span>
          </span>
        </div>
        {isHome ? (
          <nav className="ml-auto hidden items-center gap-6 md:flex">
            {homeLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
        ) : (
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
        )}
        {!isHome && active && (
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

  // Page-level drop zone: dragging over any part of the screen surfaces a soft
  // full-page overlay, so the CSV drop target isn't limited to the button.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if ((e as unknown as { relatedTarget: EventTarget | null }).relatedTarget === null) {
        setDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFile]);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-8">
      {/* Page-level drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md">
          <div className="animate-prism-lift flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-surface/80 px-10 py-8 shadow-glow">
            <Upload className="h-8 w-8 text-primary" />
            <div className="text-[15px] font-semibold tracking-tight">Drop to analyze</div>
            <div className="text-[12px] text-muted-foreground">
              Feedback column auto-detected · Stays in this session
            </div>
          </div>
        </div>
      )}

      {/* 1 — Hero */}
      <section className="flex min-h-[calc(68vh-57px)] flex-col items-center justify-center pt-8 pb-4 text-center">
        <h1 className="text-balance text-[57px] font-semibold leading-[1.02] tracking-tight sm:text-[78px]">
          Turn customer conversations
          <br className="hidden sm:block" />{" "}
          into <span className="text-primary">confident</span> product decisions.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-[19px] leading-relaxed text-muted-foreground">
          Upload customer conversations. Prism groups similar problems into opportunities you can
          defend — with the evidence attached.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
        <p className="mt-4 text-xs text-muted-foreground">
          Feedback column auto-detected · Up to 200 rows · About 15 seconds
        </p>
        <DemoNotice className="mt-2" />
      </section>

      {/* 2 — AI reasoning animation */}
      <section id="how-it-works" className="scroll-mt-20 pt-6 pb-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            How Prism thinks
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Evidence in. Reasoning out.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Every opportunity carries the trail it was built from — customer voices, recurring
            patterns, and the rationale behind the recommendation.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <SignaturePipeline />
        </div>
      </section>

      {/* 3 — Workspace preview */}
      <section id="workspace" className="scroll-mt-20 border-t border-border/50 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            The workspace
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Opportunities you can defend in a roadmap review.
          </h2>
        </div>
        <WorkspacePreview />

      </section>

      {/* 4 — Philosophy */}
      <section id="philosophy" className="scroll-mt-20 border-t border-border/50 py-10 text-center">
        <p className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="text-primary">AI synthesizes.</span>{" "}
          <span className="text-foreground">You decide.</span>
        </p>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Prism never makes the roadmap call. It hands you the evidence, the patterns, and the
          rationale — then steps back.
        </p>
      </section>

      {/* 5 — Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 py-6 text-xs text-muted-foreground">
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
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const rows = [
    { title: "Enterprise security & governance gaps", demand: 92, impact: "critical" as const, priority: 87, evidence: 11 },
    { title: "Fragmented workflows across existing tools", demand: 74, impact: "high" as const, priority: 62, evidence: 8 },
    { title: "Slow team onboarding", demand: 51, impact: "medium" as const, priority: 38, evidence: 6 },
  ];
  return (
    <div
      ref={ref}
      className={cn(
        "mt-8 overflow-hidden rounded-2xl border border-border/50 bg-surface ring-1 ring-black/[0.02] transition-all duration-700 ease-out",
        inView
          ? "translate-y-0 opacity-100 shadow-elevate-3"
          : "translate-y-3 opacity-0 shadow-elevate-2",
      )}
    >
      <div className="text-[15px]">
        <div className="grid grid-cols-[minmax(0,2fr)_170px_130px_110px] items-center gap-5 border-b border-border/40 bg-muted/25 px-8 py-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <div>Opportunity</div>
          <div>Demand</div>
          <div>Impact</div>
          <div className="text-right">Recommended</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.title}
            style={{ transitionDelay: inView ? `${180 + i * 90}ms` : "0ms" }}
            className={cn(
              "group grid cursor-pointer grid-cols-[minmax(0,2fr)_170px_130px_110px] items-center gap-5 px-8 py-6 transition-all duration-500 ease-out hover:bg-primary/[0.04]",
              i < rows.length - 1 && "border-b border-border/30",
              inView ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            )}
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium tracking-tight transition-colors group-hover:text-primary">
                {r.title}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Supported by {r.evidence} conversations
              </div>
            </div>
            <MeterCell value={r.demand} />
            <div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
                  IMPACT_TONE[r.impact],
                )}
              >
                {r.impact}
              </span>
            </div>
            <div className="text-right text-[24px] font-bold tabular-nums leading-none tracking-tight">
              {r.priority}
            </div>
          </div>
        ))}
      </div>
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
    name: "Enterprise security & governance gaps",
    customers: [
      { id: 1, quote: "Stuck in pilot until logins tie to our identity provider" },
      { id: 7, quote: "Hard to justify a broader rollout right now" },
      { id: 15, quote: "Adding four hundred people by hand isn't realistic" },
      { id: 31, quote: "Access doesn't disappear when people leave" },
    ],
  },
  {
    name: "Fragmented workflows across existing tools",
    customers: [
      { id: 4, quote: "Every team has built its own workaround" },
      { id: 12, quote: "We need clean integration points, not another UI" },
      { id: 22, quote: "Handoffs still fall through the cracks" },
    ],
  },
  {
    name: "Slow team onboarding",
    customers: [
      { id: 6, quote: "Onboarding is still mostly manual" },
      { id: 18, quote: "New hires lose a week finding things" },
      { id: 27, quote: "We keep re-teaching the same setup steps" },
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
    <div className="mx-auto max-w-4xl px-6 py-14">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
        Reading customer conversations
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        <span className="text-shimmer">Grouping conversations into opportunity areas</span>
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Reading {feedback.length} customer conversations. Prism surfaces individual voices, groups
        the recurring ones, and names the underlying problem. You take it from there.
      </p>
      <DemoNotice variant="chip" className="mt-3" />



      <AIReasoningPipeline stage={pipelineStage} className="mt-8" />

      <LoadingNarrative stage={pipelineStage} className="mt-6" />

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
                    Naming the pattern…
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

// ---------- Signature Pipeline (homepage hero-adjacent) ----------
// Premium, editorial rendering of Evidence → Patterns → Opportunity → Human Decision.
// The Opportunity card is the "aha" — visually the loudest. Cards fade+lift into view
// on scroll with a gentle stagger, connected by a continuous line so the four steps
// read as one flow, not four tiles.

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function SignaturePipeline() {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const steps = [
    {
      key: "evidence",
      label: "Evidence",
      sub: "Customer voices, verbatim",
      caption: "Conversations, tickets, interviews.",
      icon: Quote,
      owner: "ai" as const,
    },
    {
      key: "patterns",
      label: "Patterns",
      sub: "Recurring signals",
      caption: "Related voices grouped and named.",
      icon: Layers,
      owner: "ai" as const,
    },
    {
      key: "opportunity",
      label: "Opportunity",
      sub: "With rationale",
      caption: "A defensible product bet, with evidence.",
      icon: Sparkles,
      owner: "ai" as const,
      hero: true,
    },
    {
      key: "decision",
      label: "Human decision",
      sub: "PM owns the call",
      caption: "You weigh effort, strategy, revenue.",
      icon: UserIcon,
      owner: "pm" as const,
    },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Desktop layout */}
      <div className="relative hidden md:block">
        {/* Continuous connector line behind cards */}
        <div
          aria-hidden
          className={cn(
            "absolute left-[6%] right-[6%] top-[46px] h-px origin-left transition-transform duration-1000 ease-out",
            "bg-gradient-to-r from-transparent via-primary/40 to-transparent",
            inView ? "scale-x-100" : "scale-x-0",
          )}
        />
        <div className="relative grid grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <SignatureCard
              key={s.key}
              step={s}
              index={i}
              isLast={i === steps.length - 1}
              inView={inView}
              orientation="horizontal"
            />
          ))}
        </div>
      </div>

      {/* Mobile layout — vertical with a left rail */}
      <div className="relative md:hidden">
        <div
          aria-hidden
          className={cn(
            "absolute left-[22px] top-6 bottom-6 w-px origin-top transition-transform duration-1000 ease-out",
            "bg-gradient-to-b from-transparent via-primary/40 to-transparent",
            inView ? "scale-y-100" : "scale-y-0",
          )}
        />
        <div className="relative flex flex-col gap-3">
          {steps.map((s, i) => (
            <SignatureCard
              key={s.key}
              step={s}
              index={i}
              isLast={i === steps.length - 1}
              inView={inView}
              orientation="vertical"
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">AI synthesizes</span>{" "}
        <span className="text-muted-foreground/60">·</span>{" "}
        <span className="text-foreground/80">You decide</span>
      </p>
    </div>
  );
}

function SignatureCard({
  step,
  index,
  isLast,
  inView,
  orientation,
}: {
  step: {
    label: string;
    sub: string;
    caption: string;
    icon: typeof Quote;
    owner: "ai" | "pm";
    hero?: boolean;
  };
  index: number;
  isLast: boolean;
  inView: boolean;
  orientation: "horizontal" | "vertical";
}) {
  const Icon = step.icon;
  const isPm = step.owner === "pm";
  const isHero = !!step.hero;
  const delay = `${index * 110}ms`;

  return (
    <div
      className={cn(
        "relative transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
      )}
      style={{ transitionDelay: inView ? delay : "0ms" }}
    >
      <div
        className={cn(
          "group relative flex h-full flex-col gap-3 rounded-2xl border bg-surface p-5 transition-all duration-300 ease-out",
          "hover:-translate-y-0.5",
          isHero
            ? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_5%,var(--surface))] shadow-elevate-3 ring-1 ring-primary/10 hover:shadow-glow"
            : "border-border/70 shadow-elevate-1 hover:border-foreground/20 hover:shadow-elevate-2",
          orientation === "vertical" && "pl-10",
        )}
      >
        {/* Step number pill on the rail (mobile only visual anchor) */}
        {orientation === "vertical" && (
          <span
            className={cn(
              "absolute -left-[3px] top-5 grid h-6 w-6 place-items-center rounded-full border bg-background text-[10px] font-semibold tabular-nums",
              isHero ? "border-primary/50 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {index + 1}
          </span>
        )}

        <div className="flex items-center justify-between">
          <div
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg transition-colors",
              isPm
                ? "bg-foreground text-background"
                : isHero
                  ? "bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                  : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              isPm
                ? "border-border bg-muted/50 text-foreground/70"
                : "border-primary/20 bg-primary/[0.06] text-primary",
            )}
          >
            {isPm ? "You" : "AI"}
          </span>
        </div>

        <div>
          <div
            className={cn(
              "font-semibold leading-tight tracking-tight",
              isHero ? "text-[19px]" : "text-[17px]",
            )}
          >
            {step.label}
          </div>
          <div className="mt-0.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            {step.sub}
          </div>
        </div>

        <p
          className={cn(
            "text-[13px] leading-relaxed text-muted-foreground",
            isHero && "text-foreground/70",
          )}
        >
          {step.caption}
        </p>
      </div>

      {/* Horizontal connector chevron between cards */}
      {orientation === "horizontal" && !isLast && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-[46px] -right-[10px] z-10 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border bg-background text-primary transition-all duration-500",
            inView ? "opacity-100 scale-100" : "opacity-0 scale-75",
            "border-primary/25",
          )}
          style={{ transitionDelay: inView ? `${index * 110 + 250}ms` : "0ms" }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10">
            <path
              d="M2 5 H8 M5.5 2.5 L8 5 L5.5 7.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      )}
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
          <span className="text-foreground/80">you decide</span>
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
                  isActive && isPm && "border-border bg-muted/40",
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
                          ? "bg-foreground text-white"
                          : "bg-muted/40 text-foreground/80"
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

// ---------- Loading narrative (5-phase reasoning story) ----------
// Explicit story shown during processing: Conversations → Pattern detection →
// Opportunity discovered → Evidence assembled → Workspace opens. Not a decorative
// spinner — a plain-language explanation of what Prism is doing right now.
function LoadingNarrative({
  stage,
  className,
}: {
  stage: "evidence" | "patterns" | "opportunity" | "decision";
  className?: string;
}) {
  const phases = [
    { label: "Customer conversations", hint: "Reading raw voices" },
    { label: "Pattern detection", hint: "Grouping recurring signals" },
    { label: "Opportunity discovered", hint: "Naming the underlying ask" },
    { label: "Evidence assembled", hint: "Attaching quotes + rationale" },
    { label: "Workspace opens", hint: "Handing you the decision" },
  ];
  const stageToIdx: Record<typeof stage, number> = {
    evidence: 0,
    patterns: 1,
    opportunity: 2,
    decision: 3,
  };
  const activeIdx = Math.min(stageToIdx[stage] + (stage === "opportunity" ? 1 : 0), 3);
  return (
    <ol
      className={cn(
        "flex flex-wrap items-stretch gap-1.5 text-[11px]",
        className,
      )}
    >
      {phases.map((p, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        return (
          <li
            key={p.label}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 transition-all duration-500",
              isActive && "border-primary/50 bg-primary/[0.05] text-foreground shadow-elevate-1",
              isPast && "border-primary/20 bg-primary/[0.02] text-foreground/70",
              !isActive && !isPast && "border-border/50 bg-transparent text-muted-foreground/70",
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 flex-none place-items-center rounded-full text-[9px] font-semibold tabular-nums",
                isActive || isPast
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 text-muted-foreground",
              )}
            >
              {isPast ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            <span className="min-w-0 truncate font-medium">{p.label}</span>
          </li>
        );
      })}
    </ol>
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
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80",
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

// Tween a displayed number toward its target so PM input changes feel physical.
function useAnimatedNumber(value: number, duration = 380) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    from.current = display;
    start.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    const target = value;
    const step = (ts: number) => {
      if (start.current === null) start.current = ts;
      const t = Math.min(1, (ts - start.current) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from.current + (target - from.current) * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const shown = useAnimatedNumber(value);
  return <span className={cn("tabular-nums", className)}>{shown}</span>;
}

// Vertical ladder that shows how AI signal + PM inputs assemble into the
// final priority. Rungs pulse and rebuild whenever a PM input changes so the
// PM can *feel* their judgment moving the number.
function PriorityLadder({
  ai,
  strategic,
  effortPenalty,
  total,
  hasStrategic,
  hasEffort,
  emphasize = false,
}: {
  ai: number;
  strategic: number;
  effortPenalty: number;
  total: number;
  hasStrategic: boolean;
  hasEffort: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        emphasize
          ? "border-primary/40 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent"
          : "border-border/60",
      )}
    >
      <LadderRung
        kind="ai"
        label="AI customer signal"
        sublabel="Demand · confidence · impact"
        value={ai}
        sign="+"
      />
      <LadderConnector />
      <LadderRung
        kind="pm"
        label="Strategic importance"
        sublabel={hasStrategic ? "Your input" : "Awaiting your input"}
        value={strategic}
        sign="+"
        muted={!hasStrategic}
      />
      <LadderConnector />
      <LadderRung
        kind="pm"
        label="Engineering effort"
        sublabel={hasEffort ? "Your input" : "Awaiting your input"}
        value={effortPenalty}
        sign="−"
        muted={!hasEffort}
      />
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              Final priority
            </div>
            <div className="text-[11px] text-muted-foreground">
              Recomputes as you adjust inputs
            </div>
            <PriorityInfo
              label
              breakdown={{ ai, strategic, effortPenalty, total }}
              className="mt-1.5 text-[11px]"
            />
          </div>
          <AnimatedNumber
            key={total}
            value={total}
            className="animate-prism-lift text-[38px] font-semibold leading-none tracking-tight text-primary"
          />
        </div>
      </div>
    </div>
  );
}

function LadderRung({
  kind,
  label,
  sublabel,
  value,
  sign,
  muted = false,
}: {
  kind: "ai" | "pm";
  label: string;
  sublabel: string;
  value: number;
  sign: "+" | "−";
  muted?: boolean;
}) {
  const shown = useAnimatedNumber(value);
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1.5 transition-opacity",
        muted && "opacity-55",
      )}
    >
      <span
        className={cn(
          "rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
          kind === "ai"
            ? "bg-primary/10 text-primary"
            : "border border-border/60 text-muted-foreground",
        )}
      >
        {kind === "ai" ? "AI" : "You"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sublabel}</div>
      </div>
      <div
        className={cn(
          "font-mono text-[15px] tabular-nums",
          sign === "−" ? "text-foreground/80" : "text-foreground",
        )}
      >
        <span className="mr-0.5 text-muted-foreground">{sign}</span>
        {shown}
      </div>
    </div>
  );
}

function LadderConnector() {
  return (
    <div className="ml-[9px] h-2.5 w-px bg-gradient-to-b from-border/80 to-border/30" />
  );
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const rows = useMemo(
    () =>
      result.opportunities
        .map((op, i) => ({ op, i, priority: priorityScore(op, pm[i]) }))
        .sort((a, b) => b.priority - a.priority),
    [result.opportunities, pm],
  );

  const toggleSelect = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleExpand = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const updatePM = (i: number, patch: Partial<PMInput>) =>
    setPm((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

  const cols = "grid-cols-[32px_minmax(0,3fr)_120px_110px_100px_28px]";

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-[44px]">
            What opportunities are emerging?
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            AI analyzed {result.feedback.length} customer conversations and identified{" "}
            {result.opportunities.length} recurring opportunity areas. Open a row to read the
            evidence and add your side of the call — AI recommends, you decide.
          </p>
          <DemoNotice variant="chip" className="mt-3" />
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <Upload className="mr-2 h-4 w-4" />
          New upload
        </Button>
      </div>

      {result.themes.length > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Themes
          </span>
          {result.themes.map((t) => (
            <span
              key={t.name}
              title={t.description}
              className="rounded-full border border-border/50 bg-surface/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className={cn("grid items-center gap-x-3 border-b border-border/50 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground", cols)}>
          <div />
          <div>Opportunity</div>
          <div>Demand</div>
          <div>Impact</div>
          <div className="flex items-center justify-end gap-1.5 text-right">
            <span>Recommended priority</span>
            <PriorityInfo className="normal-case tracking-normal" />
          </div>
          <div />
        </div>
        {rows.map(({ op, i, priority }) => {
          const decision = decisions[i];
          const pmi = pm[i] ?? {};
          const bd = priorityBreakdown(op, pmi);
          const quote = result.feedback[op.representative_quote_index];
          const isOpen = expanded.has(i);
          return (
            <div key={i} className="border-b border-border/30 last:border-b-0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(i);
                  }
                }}
                className={cn(
                  "group grid cursor-pointer items-center gap-x-3 py-3.5 transition-colors",
                  cols,
                  selected.has(i) ? "bg-primary/[0.035]" : "hover:bg-muted/25",
                )}
              >
                <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => toggleSelect(i)}
                    aria-label={`Select ${op.title}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(i);
                      }}
                      className="text-left text-[15px] font-medium leading-snug tracking-tight hover:text-primary"
                    >
                      {op.title}
                    </button>
                    {decision && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", DECISION_META[decision].tone)}>
                        {DECISION_META[decision].label}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-1 max-w-[56ch] text-[13px] leading-relaxed text-muted-foreground">
                    {op.problem}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground/85">
                    Supported by {op.evidence_indices.length} conversations
                  </div>
                </div>
                <MeterCell value={op.customer_demand} compact />
                <div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", IMPACT_TONE[op.business_impact])}>
                    {op.business_impact}
                  </span>
                </div>
                <div className="text-right text-[26px] font-bold leading-none tracking-tight tabular-nums">
                  <AnimatedNumber value={priority} />
                </div>
                <div
                  aria-hidden
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground/70 transition-colors group-hover:bg-muted group-hover:text-foreground"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" className={cn("transition-transform duration-300", isOpen && "rotate-180")}>
                    <path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0">
                  <EditorialExpansion
                    op={op}
                    pmi={pmi}
                    priority={priority}
                    bd={bd}
                    themes={result.themes}
                    feedback={result.feedback}
                    onPMChange={(patch) => updatePM(i, patch)}
                    onOpen={() => onOpen(i)}
                    suggested={suggestDecision(priority, op.confidence)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="max-w-2xl text-[12px] text-muted-foreground">
          Recommended priority reflects customer demand and supporting evidence (AI) balanced
          against your strategic importance and engineering effort (you). AI recommends — you
          decide.
        </p>
        <PriorityInfo label className="text-[11px]" />
      </div>

      <div className="pointer-events-none sticky bottom-4 mt-4 flex justify-center">
        <div className={cn("pointer-events-auto flex items-center gap-3 rounded-full border border-border/70 bg-card/90 px-3.5 py-1.5 shadow-elevate-1 backdrop-blur transition-opacity", selected.size === 0 && "opacity-50")}>
          <span className="text-[11px] text-muted-foreground">
            {selected.size === 0 ? "Select two or more to compare" : `${selected.size} selected`}
          </span>
          <Button size="sm" disabled={selected.size < 2} onClick={() => onCompare([...selected].sort((a, b) => a - b))}>
            Compare
          </Button>
        </div>
      </div>
    </div>
  );
}

function suggestDecision(priority: number, confidence: number): Decision {
  if (priority >= 70 && confidence >= 60) return "prioritize";
  if (priority >= 45) return "investigate";
  if (confidence < 50) return "monitor";
  return "not_now";
}

function EditorialExpansion({
  op,
  pmi,
  priority,
  bd,
  themes,
  feedback,
  onPMChange,
  onOpen,
  suggested,
}: {
  op: Opportunity;
  pmi: PMInput;
  priority: number;
  bd: { ai: number; strategic: number; effortPenalty: number; total: number };
  themes: Theme[];
  feedback: string[];
  onPMChange: (patch: Partial<PMInput>) => void;
  onOpen: () => void;
  suggested: Decision;
}) {
  const evidenceIdxs = op.evidence_indices.slice(0, 3);
  const primaryQuote = feedback[op.representative_quote_index];
  const otherQuotes = evidenceIdxs
    .filter((idx) => idx !== op.representative_quote_index)
    .slice(0, 2)
    .map((idx) => feedback[idx])
    .filter(Boolean);
  const relatedThemes = themes.filter((t) => op.recurring_themes.includes(t.name));
  const meta = DECISION_META[suggested];

  return (
    <article className="mx-auto max-w-[68ch] px-2 pb-12 pt-2 pl-[calc(32px+1rem)]">
      {/* Section rail */}
      <div className="space-y-10 [&>section]:animate-prism-lift">
        {/* 1 · Opportunity summary */}
        <section>
          <SectionKicker n={1} label="Opportunity" />
          <p className="mt-3 font-display text-[19px] leading-[1.55] tracking-tight text-foreground/90">
            {op.problem}
          </p>
        </section>

        {/* 2 · Customer quotes */}
        {primaryQuote && (
          <section>
            <SectionKicker n={2} label="In their words" />
            <figure className="mt-4">
              <svg
                aria-hidden
                viewBox="0 0 32 24"
                className="h-5 w-5 text-primary/50"
                fill="currentColor"
              >
                <path d="M0 24V14C0 6.3 4.6 1.3 12 0l1.3 4C8.7 5.3 6 8.7 6 13h6v11H0zm20 0V14c0-7.7 4.6-12.7 12-14l1.3 4C28.7 5.3 26 8.7 26 13h6v11H20z" />
              </svg>
              <blockquote className="mt-2 font-display text-[22px] leading-[1.4] tracking-tight text-foreground">
                {primaryQuote.slice(0, 260)}
                {primaryQuote.length > 260 ? "…" : ""}
              </blockquote>
              <figcaption className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                Representative voice · 1 of {op.evidence_indices.length}
              </figcaption>
            </figure>
            {otherQuotes.length > 0 && (
              <div className="mt-6 space-y-4 border-l border-border/60 pl-5">
                {otherQuotes.map((q, i) => (
                  <p
                    key={i}
                    className="text-[14px] italic leading-relaxed text-muted-foreground"
                  >
                    "{q.slice(0, 180)}{q.length > 180 ? "…" : ""}"
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 3 · AI reasoning memo */}
        <section>
          <SectionKicker n={3} label="AI reasoning" ai />
          <div className="mt-3 rounded-lg border border-border/50 bg-surface-muted/50 p-5">
            <p className="text-[15px] leading-[1.7] text-foreground/85">
              Across {op.evidence_indices.length} customer conversations, the model detected a
              consistent signal around <em className="not-italic font-medium text-foreground">{op.title.toLowerCase()}</em>.
              Customer demand reads at <span className="font-semibold tabular-nums text-foreground">{Math.round(op.customer_demand)}</span>{" "}
              and confidence at <span className="font-semibold tabular-nums text-foreground">{Math.round(op.confidence)}%</span>.
            </p>
            <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
              {op.confidence_rationale}
            </p>
          </div>
        </section>

        {/* 4 · Why clustered */}
        {relatedThemes.length > 0 && (
          <section>
            <SectionKicker n={4} label="Why clustered together" />
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              These conversations were grouped under the same opportunity because they share these
              recurring themes:
            </p>
            <ul className="mt-4 space-y-3">
              {relatedThemes.map((t) => (
                <li key={t.name} className="flex gap-3">
                  <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-primary/70" />
                  <div>
                    <div className="text-[14px] font-medium tracking-tight">{t.name}</div>
                    <div className="text-[13px] leading-relaxed text-muted-foreground">
                      {t.description}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5 · Business impact */}
        <section>
          <SectionKicker n={5} label="Business impact" />
          <div className="mt-3 flex items-center gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium capitalize",
                IMPACT_TONE[op.business_impact],
              )}
            >
              {op.business_impact}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              AI-inferred
            </span>
          </div>
          <p className="mt-3 text-[15px] leading-[1.7] text-foreground/85">
            {op.business_impact_rationale}
          </p>
        </section>

        {/* 6 · PM inputs */}
        <section>
          <SectionKicker n={6} label="Your inputs" pm />
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Recommended priority weighs four factors: customer demand and supporting evidence (from
            AI), and strategic importance and engineering effort (from you). Adjust either input
            below — the recommendation recomputes live.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="rounded-lg border border-border/50 bg-surface p-4">
              <div className="space-y-3">
                <Stepper
                  label="Engineering effort"
                  hint="1 low · 10 high"
                  value={pmi.engineering_effort}
                  min={1}
                  max={10}
                  onChange={(v) => onPMChange({ engineering_effort: v })}
                />
                <Stepper
                  label="Strategic importance"
                  hint="1–5"
                  value={pmi.strategic_importance}
                  min={1}
                  max={5}
                  onChange={(v) => onPMChange({ strategic_importance: v })}
                />
              </div>
              <p className="mt-3 text-[11px] italic text-muted-foreground">
                Adjust either input — watch the ladder rebuild.
              </p>
            </div>
            <PriorityLadder
              ai={bd.ai}
              strategic={bd.strategic}
              effortPenalty={bd.effortPenalty}
              total={priority}
              hasStrategic={!!pmi.strategic_importance}
              hasEffort={!!pmi.engineering_effort}
            />
          </div>
        </section>

        {/* 7 · Recommended decision */}
        <section>
          <SectionKicker n={7} label="Recommended next step" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold",
                meta.tone,
              )}
            >
              {meta.label}
            </span>
            <span className="text-[12px] text-muted-foreground">
              A suggestion, not a verdict · priority {priority} · confidence {Math.round(op.confidence)}%
            </span>
            <Button size="sm" variant="ghost" onClick={onOpen} className="ml-auto">
              Open full memo →
            </Button>
          </div>
        </section>
      </div>
    </article>
  );
}

function SectionKicker({
  n,
  label,
  ai,
  pm,
}: {
  n: number;
  label: string;
  ai?: boolean;
  pm?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-5 w-5 place-items-center rounded-full border border-border/60 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {n}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      {ai && (
        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
          AI
        </span>
      )}
      {pm && (
        <span className="rounded-sm border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          You
        </span>
      )}
    </div>
  );
}



function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value?: number;
  min: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  const cur = value ?? 0;
  const dec = () => onChange(value === undefined ? min : Math.max(min, cur - 1));
  const inc = () => onChange(value === undefined ? min : Math.min(max, cur + 1));
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex items-center gap-1 rounded-md border border-border/70 bg-surface/60 p-0.5">
        <button
          type="button"
          onClick={dec}
          disabled={value !== undefined && value <= min}
          aria-label={`Decrease ${label}`}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          −
        </button>
        <div className="w-6 text-center text-[13px] font-semibold tabular-nums">
          {value ?? "–"}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={value !== undefined && value >= max}
          aria-label={`Increase ${label}`}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}



function MeterCell({
  value,
  tone = "primary",
  compact = false,
}: {
  value: number;
  tone?: "primary" | "muted";
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className={cn("tabular-nums font-semibold", compact ? "w-7 text-[13px]" : "w-8 text-xs")}>
          {Math.round(value)}
        </span>
        <div className={cn("flex-1 overflow-hidden rounded-full bg-muted/70", compact ? "h-1 max-w-[60px]" : "h-1.5")}>
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              tone === "primary" ? "bg-primary/70" : "bg-muted-foreground/40",
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
      className="h-8 border-border bg-muted/40 text-sm"
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
    <div className="mx-auto max-w-[1400px] px-6 py-14">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to opportunities
      </Button>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Side by side
      </p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-[44px]">
        Comparing {indices.length} opportunities
      </h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
        Two sides, kept separate:{" "}
        <span className="text-primary">what AI read from the conversations</span> and{" "}
        <span className="text-foreground/80">what you add as PM</span>. Recommended priority
        emerges from both — a recommendation, not a verdict.
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
          <CompareGroupHeader tone="ai" label="Read from customer conversations" columns={indices.length} />

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
          <CompareGroupHeader tone="pm" label="Your side of the call" columns={indices.length} />

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
                className="h-8 border-border bg-muted/40 text-sm"
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
              Recommended priority
            </div>
            <div className="text-xs text-muted-foreground">
              Emerges from customer demand, supporting evidence, and your inputs above. A
              recommendation — not a verdict.
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
                        ? "border-border bg-muted/40 text-foreground/80"
                        : "border-dashed border-border text-muted-foreground",
                    )}
                  >
                    + You {bd.strategic}
                  </span>
                  {bd.effortPenalty > 0 && (
                    <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-foreground/80">
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
          <span>= read from customer conversations, with rationale</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <PMChip>You</PMChip>
          <span>= added by you — the signal AI can't infer</span>
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
        tone === "pm" && "bg-muted/40 text-foreground/80",
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
        tone === "pm" && "border-border",
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
          : "border-border bg-muted/40 text-foreground/80",
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
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to opportunities
      </Button>

      {/* Memo header */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Priority memo
      </p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-[44px]">{op.title}</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
        {op.problem}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {op.recurring_themes.map((t) => (
          <Badge key={t} variant="secondary" className="text-xs">
            <Layers className="mr-1 h-3 w-3" />
            {t}
          </Badge>
        ))}
        <DemoNotice variant="chip" />
      </div>

      {/* How this memo is assembled — makes the AI ▸ you ▸ priority chain explicit */}
      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-border/50 bg-surface-muted/40 px-3 py-2 text-[11px]">
        {[
          { tag: "AI", text: "Customer evidence" },
          { tag: "AI", text: "Demand · impact · confidence" },
          { tag: "You", text: "Strategic importance · engineering effort" },
          { tag: null, text: "Recommended priority" },
          { tag: null, text: "Your decision" },
        ].map((step, i, arr) => (
          <span key={step.text} className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              {step.tag && (
                <span
                  className={cn(
                    "rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
                    step.tag === "AI"
                      ? "bg-primary/10 text-primary"
                      : "border border-border/60 text-muted-foreground",
                  )}
                >
                  {step.tag}
                </span>
              )}
              <span className={cn(step.tag ? "text-muted-foreground" : "font-medium text-foreground")}>
                {step.text}
              </span>
            </span>
            {i < arr.length - 1 && <span className="text-muted-foreground/50">→</span>}
          </span>
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
            className="mt-1 h-9 border-border bg-muted/40 text-sm"
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
        eyebrow="Section 4 · Recommended priority"
        title="How this recommendation is built"
        lede="Recommended priority weighs four factors — customer demand and supporting evidence from AI, and strategic importance and engineering effort from you. It's a recommendation, never a verdict."
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
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
            <p className="mt-3 text-[11px] italic text-muted-foreground">
              Change either input and the ladder on the right rebuilds.
            </p>
          </div>

          <PriorityLadder
            ai={bd.ai}
            strategic={bd.strategic}
            effortPenalty={bd.effortPenalty}
            total={bd.total}
            hasStrategic={!!pm?.strategic_importance}
            hasEffort={!!pm?.engineering_effort}
            emphasize
          />
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
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
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
        lede="AI put the evidence in front of you. The next step is yours — pick one. You can change it later."
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
                Current call:{" "}
                <span className="font-semibold text-foreground">
                  {DECISION_META[decision].label}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Take it into the roadmap review — export the one-pager.
              </p>
            </div>
            <Button size="sm" onClick={() => setSummaryOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Export one-pager
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
        source === "ai" ? "border-primary/20" : "border-border",
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
