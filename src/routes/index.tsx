import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import { ArrowLeft, Upload, Eye, Bell, EyeOff, Sparkles, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { clusterFeedback, type Opportunity } from "@/lib/cluster.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Signal — Turn feedback into ranked opportunities" },
      {
        name: "description",
        content:
          "Upload a CSV of customer feedback and get an AI-ranked list of product opportunities with evidence.",
      },
      { property: "og:title", content: "Signal — Feedback to opportunities" },
      {
        property: "og:description",
        content: "Cluster raw customer feedback into ranked, evidence-backed product opportunities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type Decision = "investigate" | "monitor" | "ignore";
type ViewState =
  | { kind: "upload" }
  | { kind: "ranking"; opportunities: Opportunity[]; feedback: string[] }
  | { kind: "detail"; index: number; opportunities: Opportunity[]; feedback: string[] };

function Home() {
  const [view, setView] = useState<ViewState>({ kind: "upload" });
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const cluster = useServerFn(clusterFeedback);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string> | string[]>(text, {
          header: true,
          skipEmptyLines: true,
        });
        let rows: string[] = [];
        if (parsed.data.length && typeof parsed.data[0] === "object" && !Array.isArray(parsed.data[0])) {
          const objects = parsed.data as Record<string, string>[];
          const keys = Object.keys(objects[0] ?? {});
          const feedbackKey =
            keys.find((k) => /feedback|comment|review|message|text|content|verbatim/i.test(k)) ??
            keys[0];
          rows = objects
            .map((r) => (feedbackKey ? r[feedbackKey] : Object.values(r).join(" ")))
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

        const result = await cluster({ data: { feedback: rows } });
        setDecisions({});
        setView({ kind: "ranking", opportunities: result.opportunities, feedback: result.feedback });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to process CSV.");
      } finally {
        setLoading(false);
      }
    },
    [cluster],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />
      {view.kind === "upload" && <UploadView loading={loading} onFile={handleFile} />}
      {view.kind === "ranking" && (
        <RankingView
          opportunities={view.opportunities}
          decisions={decisions}
          onSelect={(index) =>
            setView({
              kind: "detail",
              index,
              opportunities: view.opportunities,
              feedback: view.feedback,
            })
          }
          onReset={() => setView({ kind: "upload" })}
        />
      )}
      {view.kind === "detail" && (
        <DetailView
          opportunity={view.opportunities[view.index]}
          index={view.index}
          feedback={view.feedback}
          decision={decisions[view.index]}
          onDecide={(d) => {
            setDecisions((prev) => ({ ...prev, [view.index]: d }));
            toast.success(`Marked as ${d}`);
            setView({
              kind: "ranking",
              opportunities: view.opportunities,
              feedback: view.feedback,
            });
          }}
          onBack={() =>
            setView({
              kind: "ranking",
              opportunities: view.opportunities,
              feedback: view.feedback,
            })
          }
        />
      )}
    </div>
  );
}

function UploadView({ loading, onFile }: { loading: boolean; onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <div className="mb-10 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>AI-powered opportunity ranking</span>
      </div>
      <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">
        Turn raw feedback into ranked opportunities
      </h1>
      <p className="mt-4 max-w-xl text-center text-base text-muted-foreground">
        Upload a CSV of customer feedback. We'll cluster it, score each opportunity, and show you
        the evidence behind every one.
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
          loading && "pointer-events-none opacity-70",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Clustering feedback…</p>
            <p className="text-xs text-muted-foreground">This can take up to a minute</p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-primary/10 p-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Drop a CSV here, or click to browse</p>
            <p className="text-xs text-muted-foreground">
              We'll auto-detect the feedback column. First 200 rows are analyzed.
            </p>
          </>
        )}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
          disabled={loading}
        />
      </label>
    </div>
  );
}

function severityBadge(sev: Opportunity["severity"]) {
  const map: Record<Opportunity["severity"], string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    critical: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return map[sev];
}

const decisionMeta: Record<Decision, { label: string; icon: typeof Eye; className: string }> = {
  investigate: { label: "Investigate", icon: Sparkles, className: "bg-primary text-primary-foreground" },
  monitor: { label: "Monitor", icon: Bell, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  ignore: { label: "Ignore", icon: EyeOff, className: "bg-muted text-muted-foreground" },
};

function RankingView({
  opportunities,
  decisions,
  onSelect,
  onReset,
}: {
  opportunities: Opportunity[];
  decisions: Record<number, Decision>;
  onSelect: (index: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ranked opportunities
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {opportunities.length} opportunities from your feedback
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sorted by priority score. Click one to see the evidence and decide.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <Upload className="mr-2 h-4 w-4" />
          New upload
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {opportunities.map((op, i) => {
          const decision = decisions[i];
          const DIcon = decision ? decisionMeta[decision].icon : null;
          return (
            <Card
              key={i}
              onClick={() => onSelect(i)}
              className="cursor-pointer border-border/60 p-5 transition-colors hover:border-primary/50 hover:bg-accent/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10">
                  <span className="text-xl font-semibold text-primary">{Math.round(op.score)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    score
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{op.title}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {op.theme}
                    </Badge>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        severityBadge(op.severity),
                      )}
                    >
                      {op.severity}
                    </span>
                    {decision && DIcon && (
                      <span
                        className={cn(
                          "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          decisionMeta[decision].className,
                        )}
                      >
                        <DIcon className="h-3 w-3" />
                        {decisionMeta[decision].label}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{op.summary}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {op.evidence_indices.length} pieces of evidence
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DetailView({
  opportunity,
  index,
  feedback,
  decision,
  onDecide,
  onBack,
}: {
  opportunity: Opportunity;
  index: number;
  feedback: string[];
  decision?: Decision;
  onDecide: (d: Decision) => void;
  onBack: () => void;
}) {
  const evidence = useMemo(
    () =>
      opportunity.evidence_indices
        .map((i) => ({ i, text: feedback[i] }))
        .filter((e) => typeof e.text === "string"),
    [opportunity, feedback],
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to opportunities
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{opportunity.theme}</Badge>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            severityBadge(opportunity.severity),
          )}
        >
          {opportunity.severity} severity
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Score {Math.round(opportunity.score)}
        </span>
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{opportunity.title}</h1>
      <p className="mt-3 text-base text-muted-foreground">{opportunity.summary}</p>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence ({evidence.length})
          </h2>
        </div>
        <ScrollArea className="max-h-[420px] rounded-lg border border-border/60">
          <ul className="divide-y divide-border/60">
            {evidence.map((e) => (
              <li key={e.i} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
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

      <div className="mt-8 rounded-xl border border-border/60 bg-card p-5">
        <div className="mb-1 text-sm font-semibold">Your decision</div>
        <p className="mb-4 text-sm text-muted-foreground">
          How should the team handle this opportunity?
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <DecisionButton
            active={decision === "investigate"}
            onClick={() => onDecide("investigate")}
            icon={Sparkles}
            title="Investigate"
            description="Dig deeper. Talk to users, size the impact."
            tone="primary"
          />
          <DecisionButton
            active={decision === "monitor"}
            onClick={() => onDecide("monitor")}
            icon={Bell}
            title="Monitor"
            description="Not now — watch if it grows."
            tone="blue"
          />
          <DecisionButton
            active={decision === "ignore"}
            onClick={() => onDecide("ignore")}
            icon={EyeOff}
            title="Ignore"
            description="Not aligned with priorities."
            tone="muted"
          />
        </div>
        {decision && (
          <p className="mt-4 text-xs text-muted-foreground">
            Current decision: <span className="font-medium capitalize text-foreground">{decision}</span>
          </p>
        )}
      </div>
      <div className="sr-only" aria-hidden>
        opp-{index}
      </div>
    </div>
  );
}

function DecisionButton({
  active,
  onClick,
  icon: Icon,
  title,
  description,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  title: string;
  description: string;
  tone: "primary" | "blue" | "muted";
}) {
  const toneRing: Record<typeof tone, string> = {
    primary: "ring-primary bg-primary/5",
    blue: "ring-blue-500 bg-blue-500/5",
    muted: "ring-foreground bg-muted",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border border-border/60 p-4 text-left transition-all hover:border-foreground/30",
        active && `ring-2 ${toneRing[tone]}`,
      )}
    >
      <Icon className="mb-2 h-5 w-5" />
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
