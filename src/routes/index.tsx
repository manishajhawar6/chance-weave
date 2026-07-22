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
  Loader2,
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
  Lock,
  Play,
  Compass,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Signal — Compare feedback opportunities side-by-side" },
      {
        name: "description",
        content:
          "Upload customer feedback CSVs. AI extracts opportunities with evidence and confidence; you add effort, strategic importance, and revenue to prioritize.",
      },
      { property: "og:title", content: "Signal — Prioritize opportunities from feedback" },
      {
        property: "og:description",
        content:
          "A side-by-side comparison workspace that fuses AI-sourced customer signals with PM-scored effort and strategic importance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

        setScreen({ kind: "processing", feedback: rows });
        setPm({});
        setDecisions({});
        const result = await cluster({ data: { feedback: rows } });
        setScreen({ kind: "opportunities", result });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to process CSV.");
        setScreen({ kind: "upload" });
      }
    },
    [cluster],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />
      <FlowStepper screen={screen} />
      {screen.kind === "upload" && <UploadScreen onFile={handleFile} />}
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

function FlowStepper({ screen }: { screen: Screen }) {
  const activeIndex = STEP_ORDER.findIndex((s) => s.kinds.includes(screen.kind));
  return (
    <div className="border-b border-border/60 bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-3 text-xs">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-semibold tracking-tight">Signal</span>
        <div className="mx-4 hidden flex-1 items-center gap-2 md:flex">
          {STEP_ORDER.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  i < activeIndex && "bg-primary/20 text-primary",
                  i === activeIndex && "bg-primary text-primary-foreground",
                  i > activeIndex && "bg-muted text-muted-foreground",
                )}
              >
                {i < activeIndex ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "font-medium",
                  i === activeIndex ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STEP_ORDER.length - 1 && <div className="mx-1 h-px w-8 bg-border" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Screen 1: Upload ----------

function UploadScreen({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="mx-auto flex min-h-[calc(100vh-49px)] max-w-3xl flex-col items-center justify-center px-6 py-16">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Step 1 of 4
      </p>
      <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">
        What customer evidence do I want to analyze?
      </h1>
      <p className="mt-4 max-w-xl text-center text-base text-muted-foreground">
        Upload a CSV of raw customer feedback. Support tickets, survey responses, review exports — anything with
        one comment per row.
      </p>

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
          "mt-10 flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <div className="rounded-full bg-primary/10 p-3">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium">Drop a CSV here, or click to browse</p>
        <p className="text-xs text-muted-foreground">
          Auto-detects the feedback column · First 200 rows analyzed
        </p>
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

      <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" /> AI extracts patterns & evidence
        </div>
        <div className="flex items-center gap-1.5">
          <UserIcon className="h-3.5 w-3.5" /> You score effort & strategy
        </div>
      </div>
    </div>
  );
}

// ---------- Screen 2: Processing (staged reasoning) ----------

const STAGES = [
  { label: "Reading customer feedback", detail: "Parsing verbatims, filtering noise" },
  { label: "Detecting recurring themes", detail: "Grouping by topic and sentiment" },
  { label: "Extracting opportunities", detail: "Identifying distinct problems & requests" },
  { label: "Scoring customer demand", detail: "Weighing frequency and intensity" },
  { label: "Estimating confidence", detail: "How well-supported is each pattern?" },
  { label: "Linking evidence", detail: "Attaching direct quotes to each opportunity" },
];

function ProcessingScreen({ feedback }: { feedback: string[] }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 2200);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Step 2 of 4
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        What patterns is AI discovering?
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Analyzing {feedback.length} feedback items. Each step below is happening on the server —
        you'll see the results next.
      </p>

      <Card className="mt-8 border-border/60 p-6">
        <ol className="space-y-4">
          {STAGES.map((s, i) => {
            const state = i < stage ? "done" : i === stage ? "active" : "pending";
            return (
              <li key={s.label} className="flex items-start gap-4">
                <div
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    state === "done" && "bg-primary/20 text-primary",
                    state === "active" && "bg-primary text-primary-foreground",
                    state === "pending" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : state === "active" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="text-[10px] font-semibold">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      state === "pending" && "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                </div>
                <Bot
                  className={cn(
                    "h-4 w-4 shrink-0",
                    state === "active" ? "text-primary" : "text-muted-foreground/50",
                  )}
                />
              </li>
            );
          })}
        </ol>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        This usually takes 20–60 seconds depending on dataset size.
      </p>
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

function priorityScore(op: Opportunity, pm?: PMInput) {
  // AI weight: customer_demand (0-100) * confidence (0-100) / 100 => 0-100
  const aiSignal = (op.customer_demand * op.confidence) / 100;
  // PM weight: strategic_importance (1-5) * 15 => 15-75; effort penalty
  const strategic = pm?.strategic_importance ? pm.strategic_importance * 15 : 0;
  const effortPenalty = pm?.engineering_effort ? pm.engineering_effort * 3 : 0;
  return Math.max(0, Math.round(aiSignal * 0.6 + strategic - effortPenalty));
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Step 3 of 4
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            What opportunities are emerging?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {result.opportunities.length} opportunities extracted from {result.feedback.length}{" "}
            feedback items. Add your effort and strategic scores, then select 2+ to compare
            side-by-side.
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

      <div className="mt-8 overflow-hidden rounded-xl border border-border/60">
        <div className="grid grid-cols-[36px_minmax(0,2fr)_120px_100px_100px_140px_140px_120px] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div />
          <div>Opportunity</div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" /> Demand <AIChip>AI</AIChip>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Impact <AIChip>AI</AIChip>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Conf. <AIChip>AI</AIChip>
          </div>
          <div className="flex items-center gap-1">
            Effort <PMChip>You</PMChip>
          </div>
          <div className="flex items-center gap-1">
            Strategic <PMChip>You</PMChip>
          </div>
          <div className="text-right">Priority</div>
        </div>
        {rows.map(({ op, i, priority }) => {
          const decision = decisions[i];
          const pmi = pm[i] ?? {};
          return (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[36px_minmax(0,2fr)_120px_100px_100px_140px_140px_120px] items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0",
                selected.has(i) && "bg-primary/5",
              )}
            >
              <Checkbox
                checked={selected.has(i)}
                onCheckedChange={() => toggle(i)}
                aria-label={`Select ${op.title}`}
              />
              <button
                onClick={() => onOpen(i)}
                className="text-left"
              >
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
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {op.problem}
                </div>
              </button>
              <MeterCell value={op.customer_demand} />
              <div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    IMPACT_TONE[op.business_impact],
                  )}
                >
                  {op.business_impact}
                </span>
              </div>
              <MeterCell value={op.confidence} tone="muted" />
              <NumInput
                value={pmi.engineering_effort}
                onChange={(v) => updatePM(i, { engineering_effort: v })}
                min={1}
                max={10}
                placeholder="1-10"
              />
              <NumInput
                value={pmi.strategic_importance}
                onChange={(v) => updatePM(i, { strategic_importance: v })}
                min={1}
                max={5}
                placeholder="1-5"
              />
              <div className="text-right">
                <span className="text-lg font-semibold tabular-nums">{priority}</span>
                <div className="text-[10px] text-muted-foreground">blended</div>
              </div>
            </div>
          );
        })}
      </div>

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
        AI-sourced signals are on the top rows; your inputs are on the bottom rows. The blended
        priority combines both.
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

          <CompareRowLabel tone="ai">
            <Users className="h-3.5 w-3.5" /> Customer demand
          </CompareRowLabel>
          {indices.map((i) => (
            <CompareCell key={`d-${i}`}>
              <MeterCell value={result.opportunities[i].customer_demand} />
            </CompareCell>
          ))}

          <CompareRowLabel tone="ai">
            <TrendingUp className="h-3.5 w-3.5" /> Business impact
          </CompareRowLabel>
          {indices.map((i) => {
            const op = result.opportunities[i];
            return (
              <CompareCell key={`bi-${i}`}>
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
              <CompareCell key={`ev-${i}`}>
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
              <CompareCell key={`c-${i}`}>
                <MeterCell value={op.confidence} tone="muted" />
                <p className="mt-2 text-xs text-muted-foreground">{op.confidence_rationale}</p>
              </CompareCell>
            );
          })}

          <CompareRowLabel tone="pm">
            <Target className="h-3.5 w-3.5" /> Engineering effort
          </CompareRowLabel>
          {indices.map((i) => (
            <CompareCell key={`e-${i}`}>
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
            <CompareCell key={`s-${i}`}>
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
            <CompareCell key={`r-${i}`}>
              <Input
                value={pm[i]?.revenue_opportunity ?? ""}
                placeholder="e.g. $40k ARR at risk"
                onChange={(e) => updatePM(i, { revenue_opportunity: e.target.value })}
                className="h-8 border-amber-500/30 bg-amber-500/5 text-sm"
              />
            </CompareCell>
          ))}

          <CompareRowLabel>Blended priority</CompareRowLabel>
          {indices.map((i, k) => {
            const p = priorities[k];
            const winner = p === Math.max(...priorities) && priorities.length > 1;
            return (
              <CompareCell key={`p-${i}`}>
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
              </CompareCell>
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

function CompareCell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border/60 bg-card p-3">{children}</div>;
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
  const priority = priorityScore(op, pm);
  const evidence = useMemo(
    () =>
      op.evidence_indices
        .map((i) => ({ i, text: result.feedback[i] }))
        .filter((e) => typeof e.text === "string"),
    [op, result.feedback],
  );
  const patch = (p: Partial<PMInput>) => setPm({ ...pm, ...p });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to opportunities
      </Button>

      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Step 4 of 4
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Why does <span className="text-primary">{op.title}</span> matter?
      </h1>
      <p className="mt-3 max-w-3xl text-base text-muted-foreground">{op.problem}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {op.recurring_themes.map((t) => (
          <Badge key={t} variant="secondary" className="text-xs">
            <Layers className="mr-1 h-3 w-3" />
            {t}
          </Badge>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <SignalCard
          source="ai"
          icon={Users}
          title="Customer demand"
          value={`${Math.round(op.customer_demand)} / 100`}
          rationale={`${op.evidence_indices.length} feedback items support this pattern.`}
        >
          <MeterCell value={op.customer_demand} />
        </SignalCard>
        <SignalCard
          source="ai"
          icon={TrendingUp}
          title="Business impact"
          value={op.business_impact}
          rationale={op.business_impact_rationale}
        >
          <span
            className={cn(
              "inline-block rounded-full px-3 py-1 text-sm font-medium capitalize",
              IMPACT_TONE[op.business_impact],
            )}
          >
            {op.business_impact}
          </span>
        </SignalCard>
        <SignalCard
          source="ai"
          icon={ShieldCheck}
          title="Confidence"
          value={`${Math.round(op.confidence)} / 100`}
          rationale={op.confidence_rationale}
        >
          <MeterCell value={op.confidence} tone="muted" />
        </SignalCard>
        <SignalCard
          source="pm"
          icon={UserIcon}
          title="Your inputs"
          value="Why leadership should care"
          rationale="These signals cannot be inferred from feedback alone."
        >
          <div className="mt-2 space-y-3">
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
            <div>
              <Label className="text-xs">Revenue opportunity (optional)</Label>
              <Input
                value={pm?.revenue_opportunity ?? ""}
                onChange={(e) => patch({ revenue_opportunity: e.target.value })}
                placeholder="e.g. $40k ARR at risk"
                className="h-8 border-amber-500/30 bg-amber-500/5 text-sm"
              />
            </div>
          </div>
        </SignalCard>
      </div>

      <Card className="mt-6 border-primary/30 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Blended priority
            </div>
            <div className="text-xs text-muted-foreground">
              Combines AI customer signal with your effort & strategic scoring.
            </div>
          </div>
          <div className="text-4xl font-semibold tabular-nums">{priority}</div>
        </div>
      </Card>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence · why should I believe this?
        </h2>
        <ScrollArea className="mt-3 max-h-[360px] rounded-lg border border-border/60">
          <ul className="divide-y divide-border/60">
            {evidence.map((e) => (
              <li key={e.i} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  #{e.i + 1}
                </span>
                <p className="text-sm leading-relaxed">{e.text}</p>
                {e.i === op.representative_quote_index && (
                  <Badge variant="secondary" className="ml-auto self-start text-[10px]">
                    representative
                  </Badge>
                )}
              </li>
            ))}
            {evidence.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted-foreground">No evidence linked.</li>
            )}
          </ul>
        </ScrollArea>
      </div>

      <div className="mt-10 rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Step 5 · Decision
        </p>
        <h2 className="mt-1 text-xl font-semibold">What should I do next?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one. You can revisit and change it anytime.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-4 text-xs text-muted-foreground">
            Current decision:{" "}
            <span className="font-medium text-foreground">{DECISION_META[decision].label}</span>
          </p>
        )}
      </div>
    </div>
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
