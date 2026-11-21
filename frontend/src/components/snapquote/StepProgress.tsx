import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "What the AI sees", "Preview & estimate", "Get contracts"];

export function StepProgress({ step }: { step: number }) {
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <div className="space-y-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-page-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-primary bg-highlight text-highlight-foreground",
                  !active && !done && "border-page-border text-page-muted",
                )}
              >
                {done ? <Check className="size-3.5" /> : n}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  active ? "font-semibold text-foreground" : "text-page-muted",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
