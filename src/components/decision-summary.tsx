import { useMemo } from "react";
import { Download, Printer, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import type { ClusterResult, Opportunity } from "@/lib/cluster.functions";

type Decision = "prioritize" | "investigate" | "monitor" | "not_now";

type PMInput = {
  engineering_effort?: number;
  strategic_importance?: number;
  revenue_opportunity?: string;
};

const DECISION_LABEL: Record<Decision, string> = {
  prioritize: "Prioritize This Quarter",
  investigate: "Investigate Further",
  monitor: "Monitor",
  not_now: "Not Now",
};

function effortTier(n?: number): string {
  if (!n) return "Not scored";
  if (n <= 3) return "Low";
  if (n <= 7) return "Medium";
  return "High";
}

function strategicTier(n?: number): string {
  if (!n) return "Not scored";
  if (n <= 2) return "Low";
  if (n === 3) return "Medium";
  return "High";
}

// Approximate distinct-customer count from evidence indices — treats each cited
// item as a customer voice. The exact source rows are also listed below.
function customerCount(op: Opportunity): number {
  return op.evidence_indices.length;
}

// Build the plain-text version for copy / download-as-text.
function buildText(op: Opportunity, pm: PMInput | undefined, decision: Decision, quotes: string[]): string {
  const lines: string[] = [];
  lines.push(`ONE-PAGE DECISION SUMMARY`);
  lines.push(``);
  lines.push(`Opportunity: ${op.title}`);
  lines.push(`Decision:    ${DECISION_LABEL[decision]}`);
  lines.push(`Date:        ${new Date().toLocaleDateString()}`);
  lines.push(``);
  lines.push(`WHY IT MATTERS — EVIDENCE`);
  lines.push(`• ${customerCount(op)} customer${customerCount(op) === 1 ? "" : "s"} raised this pattern`);
  lines.push(`• Customer demand signal: ${Math.round(op.customer_demand)} / 100`);
  lines.push(`• Business impact: ${op.business_impact.toUpperCase()} — ${op.business_impact_rationale}`);
  lines.push(`• AI confidence: ${Math.round(op.confidence)}% — ${op.confidence_rationale}`);
  if (op.recurring_themes.length) {
    lines.push(`• Recurring themes: ${op.recurring_themes.join(", ")}`);
  }
  lines.push(``);
  lines.push(`PROBLEM`);
  lines.push(op.problem);
  lines.push(``);
  lines.push(`PM INPUTS`);
  lines.push(`• Engineering effort: ${effortTier(pm?.engineering_effort)}${pm?.engineering_effort ? ` (${pm.engineering_effort}/10)` : ""}`);
  lines.push(`• Strategic importance: ${strategicTier(pm?.strategic_importance)}${pm?.strategic_importance ? ` (${pm.strategic_importance}/5)` : ""}`);
  if (pm?.revenue_opportunity) {
    lines.push(`• Revenue opportunity: ${pm.revenue_opportunity}`);
  }
  lines.push(``);
  if (quotes.length) {
    lines.push(`REPRESENTATIVE CUSTOMER QUOTES`);
    quotes.slice(0, 5).forEach((q, i) => {
      lines.push(`${i + 1}. "${q}"`);
    });
    lines.push(``);
  }
  lines.push(`DECISION: ${DECISION_LABEL[decision]}`);
  return lines.join("\n");
}

// Build a printable, self-contained HTML page for Print → Save as PDF.
function buildHtml(op: Opportunity, pm: PMInput | undefined, decision: Decision, quotes: string[]): string {
  const cust = customerCount(op);
  const themes = op.recurring_themes;
  const revenue = pm?.revenue_opportunity?.trim();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(op.title)} — Decision Summary</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #fff; }
  .page { max-width: 780px; margin: 0 auto; }
  .kicker { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; font-weight: 600; }
  h1 { font-size: 28px; margin: 4px 0 6px; line-height: 1.15; }
  .decision-pill { display: inline-block; padding: 6px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; margin-top: 8px; }
  .decision-pill.investigate { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .decision-pill.monitor { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
  .decision-pill.not_now { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
  h2 { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; margin: 24px 0 8px; font-weight: 600; }
  .problem { font-size: 15px; line-height: 1.5; color: #1e293b; }
  ul.evidence { list-style: none; padding: 0; margin: 0; }
  ul.evidence li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  ul.evidence li:last-child { border-bottom: none; }
  ul.evidence strong { color: #0f172a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .cell { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .cell .label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; font-weight: 600; }
  .cell .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
  .cell .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  blockquote { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #cbd5e1; color: #334155; font-size: 13px; font-style: italic; }
  .decision-final { margin-top: 32px; padding: 16px 20px; border: 2px solid #0f172a; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
  .decision-final .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; font-weight: 600; }
  .decision-final .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .themes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .theme { font-size: 11px; padding: 3px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; }
  .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
  <div class="page">
    <div class="kicker">One-page decision summary</div>
    <h1>${escapeHtml(op.title)}</h1>
    <span class="decision-pill ${decision}">${escapeHtml(DECISION_LABEL[decision])}</span>

    <h2>The problem</h2>
    <p class="problem">${escapeHtml(op.problem)}</p>
    ${themes.length ? `<div class="themes">${themes.map((t) => `<span class="theme">${escapeHtml(t)}</span>`).join("")}</div>` : ""}

    <h2>Evidence-based reasons</h2>
    <ul class="evidence">
      <li><strong>${cust}</strong> customer${cust === 1 ? "" : "s"} raised this in the analyzed feedback</li>
      <li><strong>${op.business_impact.toUpperCase()}</strong> business impact — ${escapeHtml(op.business_impact_rationale)}</li>
      <li>AI confidence <strong>${Math.round(op.confidence)}%</strong> — ${escapeHtml(op.confidence_rationale)}</li>
      <li>Customer-demand signal: <strong>${Math.round(op.customer_demand)} / 100</strong></li>
      ${revenue ? `<li>Revenue signal: <strong>${escapeHtml(revenue)}</strong></li>` : ""}
    </ul>

    <h2>Effort &amp; strategic fit (PM-scored)</h2>
    <div class="grid">
      <div class="cell">
        <div class="label">Engineering effort</div>
        <div class="value">${escapeHtml(effortTier(pm?.engineering_effort))}</div>
        <div class="sub">${pm?.engineering_effort ? `${pm.engineering_effort}/10` : "Not scored"}</div>
      </div>
      <div class="cell">
        <div class="label">Strategic importance</div>
        <div class="value">${escapeHtml(strategicTier(pm?.strategic_importance))}</div>
        <div class="sub">${pm?.strategic_importance ? `${pm.strategic_importance}/5 alignment` : "Not scored"}</div>
      </div>
      <div class="cell">
        <div class="label">Revenue opportunity</div>
        <div class="value" style="font-size:14px">${escapeHtml(revenue || "Not specified")}</div>
        <div class="sub">Optional PM input</div>
      </div>
    </div>

    ${quotes.length ? `<h2>Representative customer quotes</h2>${quotes.slice(0, 4).map((q) => `<blockquote>"${escapeHtml(q)}"</blockquote>`).join("")}` : ""}

    <div class="decision-final">
      <div>
        <div class="label">Decision</div>
        <div class="value">${escapeHtml(DECISION_LABEL[decision])}</div>
      </div>
      <div style="font-size:11px;color:#64748b">${new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</div>
    </div>

    <div class="footer">Generated from customer feedback analysis — evidence-based prioritization. Numbers derive from AI clustering of ${cust} supporting feedback item${cust === 1 ? "" : "s"}; PM inputs entered separately.</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function DecisionSummaryDialog({
  open,
  onOpenChange,
  result,
  index,
  pm,
  decision,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: ClusterResult & { feedback: string[] };
  index: number;
  pm?: PMInput;
  decision: Decision;
}) {
  const op = result.opportunities[index];
  const quotes = useMemo(
    () =>
      op.evidence_indices
        .map((i) => result.feedback[i])
        .filter((q): q is string => typeof q === "string" && q.length > 0),
    [op.evidence_indices, result.feedback],
  );
  const text = useMemo(() => buildText(op, pm, decision, quotes), [op, pm, decision, quotes]);
  const html = useMemo(() => buildHtml(op, pm, decision, quotes), [op, pm, decision, quotes]);
  const cust = customerCount(op);

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) {
      toast.error("Popup blocked — please allow popups and try again.");
      return;
    }
    win.document.write(html);
    win.document.close();
    // Give the browser a tick to lay out before print.
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${op.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}-summary.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Summary downloaded.");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied to clipboard.");
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            One-page decision summary
          </DialogTitle>
          <DialogDescription>
            A roadmap-meeting-ready page: opportunity, evidence-based reasons, PM-scored effort and
            strategy, and the decision.
          </DialogDescription>
        </DialogHeader>

        {/* Live preview — mirrors the printable HTML */}
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            One-page decision summary
          </div>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">{op.title}</h3>
          <div className="mt-2 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {DECISION_LABEL[decision]}
          </div>

          <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            The problem
          </div>
          <p className="mt-1 text-sm leading-relaxed">{op.problem}</p>

          <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence-based reasons
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <span className="font-semibold">{cust}</span> customer{cust === 1 ? "" : "s"} raised
              this in the analyzed feedback
            </li>
            <li>
              <span className="font-semibold uppercase">{op.business_impact}</span> business impact
              — {op.business_impact_rationale}
            </li>
            <li>
              AI confidence <span className="font-semibold">{Math.round(op.confidence)}%</span> —{" "}
              {op.confidence_rationale}
            </li>
            {pm?.revenue_opportunity && (
              <li>
                Revenue signal:{" "}
                <span className="font-semibold">{pm.revenue_opportunity}</span>
              </li>
            )}
          </ul>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Engineering effort
              </div>
              <div className="mt-1 text-base font-semibold">{effortTier(pm?.engineering_effort)}</div>
            </div>
            <div className="rounded border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Strategic fit
              </div>
              <div className="mt-1 text-base font-semibold">{strategicTier(pm?.strategic_importance)}</div>
            </div>
            <div className="rounded border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Decision
              </div>
              <div className="mt-1 text-sm font-semibold">{DECISION_LABEL[decision]}</div>
            </div>
          </div>

          {quotes.length > 0 && (
            <>
              <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Representative quotes
              </div>
              <div className="mt-2 space-y-2">
                {quotes.slice(0, 3).map((q, i) => (
                  <blockquote
                    key={i}
                    className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground"
                  >
                    "{q}"
                  </blockquote>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy as text
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download HTML
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
