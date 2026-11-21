import { AlertTriangle, ArrowLeft, Loader2, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Detection } from "@/lib/snapquote-api";
import { conditionTone } from "@/lib/quote-format";
import { cn } from "@/lib/utils";

export const CUSTOM = -1;

interface Props {
  detection: Detection;
  selected: number | null;
  onSelect: (i: number) => void;
  customText: string;
  onCustomText: (t: string) => void;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted px-3 py-2.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

export function DetectionStep(p: Props) {
  const d = p.detection;
  if (p.loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3 text-card-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="font-semibold">Rendering your preview… (10–20s)</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Skeleton className="aspect-square w-full bg-muted" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-40 bg-muted" />
              <Skeleton className="h-10 w-full bg-muted" />
              <Skeleton className="h-24 w-full bg-muted" />
              <Skeleton className="h-24 w-full bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canContinue = p.selected !== null && (p.selected !== CUSTOM || p.customText.trim().length > 2);

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-6 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rust">What the AI sees</p>
          <h2 className="mt-1 text-3xl font-extrabold capitalize">{d.item_label}</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Material" value={d.material} />
          <Fact
            label="Condition"
            value={
              <Badge variant={conditionTone(d.condition)} className="mt-0.5 capitalize">
                {d.condition}
              </Badge>
            }
          />
          <Fact label="Quantity" value={<span className="font-numeric text-xl">{d.quantity}</span>} />
          <Fact label="Approx. size" value={d.approx_dimensions} />
        </div>

        {(d.visible_issues.length > 0 || d.structural_concern) && (
          <div className="flex flex-wrap gap-2">
            {d.structural_concern && (
              <Badge variant="danger" className="gap-1 py-1">
                <AlertTriangle className="size-3.5" /> Possible structural work
              </Badge>
            )}
            {d.visible_issues.map((issue) => (
              <Badge key={issue} variant="muted" className="py-1 font-medium">
                {issue}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-lg font-bold">Pick a replacement</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.replacement_options.map((o, i) => (
              <button
                key={o.name + i}
                type="button"
                onClick={() => p.onSelect(i)}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  p.selected === i ? "border-primary bg-highlight" : "border-border hover:border-primary/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{o.name}</span>
                  {o.localFavorite ? (
                    <Badge variant="highlight" className="shrink-0 gap-1">
                      <Star className="size-3" /> Local pick · {o.localFavorite}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{o.prompt}</p>
              </button>
            ))}
            <div
              role="button"
              tabIndex={0}
              onClick={() => p.onSelect(CUSTOM)}
              onKeyDown={(e) => e.key === "Enter" && p.onSelect(CUSTOM)}
              className={cn(
                "cursor-pointer rounded-lg border-2 border-dashed p-4 transition-colors",
                p.selected === CUSTOM ? "border-primary bg-highlight" : "border-border hover:border-primary/50",
              )}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="size-4 text-rust" /> Something else
              </span>
              <Input
                className="mt-2 bg-card"
                placeholder="e.g. black aluminium sliding window"
                value={p.customText}
                onFocus={() => p.onSelect(CUSTOM)}
                onChange={(e) => p.onCustomText(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="xl" onClick={p.onBack}>
            <ArrowLeft /> Back
          </Button>
          <Button size="xl" className="flex-1 sm:flex-none" disabled={!canContinue} onClick={p.onContinue}>
            <Sparkles /> Visualize & estimate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
