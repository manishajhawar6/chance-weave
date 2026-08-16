import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Explains the *actual* priority calculation used in this app. Keep the copy in
// sync with priorityBreakdown() in src/routes/index.tsx.
export function PriorityInfo({
  breakdown,
  className,
}: {
  breakdown?: { ai: number; strategic: number; effortPenalty: number; total: number };
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        aria-label="How is priority calculated?"
        className={cn(
          "inline-flex items-center gap-1 rounded text-[10px] font-medium text-muted-foreground/80 transition-colors hover:text-foreground",
          className,
        )}
      >
        <Info className="h-3 w-3" />
        <span className="sr-only sm:not-sr-only">How is priority calculated?</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[320px] p-4 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          How priority is calculated
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
          Priority combines the AI customer signal with your strategic importance input, minus an
          allowance for engineering effort. It is a decision-support signal, not an objective score.
        </p>
        <div className="mt-3 rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
          AI signal = (demand × confidence ÷ 100) × 0.6 + impact bonus
          <br />
          impact bonus: low 0 · medium 5 · high 12 · critical 20
          <br />
          Priority = AI signal + (importance × 15) − (effort × 3)
        </div>
        {breakdown && (
          <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
            <li className="flex justify-between gap-3">
              <span>AI signal (demand · confidence · impact)</span>
              <span className="tabular-nums text-foreground">+{breakdown.ai}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Strategic importance (yours)</span>
              <span className="tabular-nums text-foreground">+{breakdown.strategic}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Engineering effort (yours)</span>
              <span className="tabular-nums text-foreground">−{breakdown.effortPenalty}</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-border/60 pt-1 font-medium text-foreground">
              <span>Priority</span>
              <span className="tabular-nums">{breakdown.total}</span>
            </li>
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Values are clamped at 0. AI never sets importance or effort — those are yours.
        </p>
      </PopoverContent>
    </Popover>
  );
}

// Subtle, professional disclosure: the dataset behind the demo is synthetic,
// while the clustering itself is a real model call.
export function DemoNotice({
  variant = "line",
  className,
}: {
  variant?: "line" | "chip";
  className?: string;
}) {
  const text =
    "Portfolio demo · results are generated from a prepared synthetic dataset";
  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
          className,
        )}
        title="The demo dataset is synthetic. Uploaded CSVs are analyzed in the same way and never leave this session."
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        Demo mode · prepared synthetic dataset
      </span>
    );
  }
  return (
    <p className={cn("text-[11px] text-muted-foreground/90", className)} title={text}>
      {text}
    </p>
  );
}
