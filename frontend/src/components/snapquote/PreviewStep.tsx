import { ArrowLeft, ArrowRight, CalendarDays, ClipboardCheck, MapPin, Package, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import type { Estimate } from "@/lib/snapquote-api";
import { calibrationText, multipliersText, scoreTone, usd } from "@/lib/quote-format";
import { cn } from "@/lib/utils";

interface Props {
  before: string;
  after: string;
  mode: "inpaint" | "img2img";
  estimate: Estimate;
  region: string;
  onBack: () => void;
  onContinue: () => void;
}

const toneText = { success: "text-success", warning: "text-warning", danger: "text-destructive" } as const;
const toneBg = { success: "bg-success-soft", warning: "bg-warning-soft", danger: "bg-danger-soft" } as const;

function List({ icon: Icon, title, items }: { icon: typeof Wrench; title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-rust" /> {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((s) => (
          <li key={s} className="flex gap-2 text-sm">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreviewStep(p: Props) {
  const e = p.estimate;
  const pr = e.price;
  const tone = scoreTone(e.feasibility_score);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <BeforeAfterSlider before={p.before} after={p.after} />
            <p className="text-sm text-muted-foreground">
              {p.mode === "inpaint"
                ? "Replaced only the area you painted"
                : "Whole-photo restyle. Paint the area for a precise swap."}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className={cn("flex items-center gap-5 rounded-xl p-4", toneBg[tone])}>
              <div className={cn("font-numeric text-6xl font-extrabold leading-none", toneText[tone])}>
                {e.feasibility_score}
                <span className="text-2xl text-muted-foreground">/10</span>
              </div>
              <div>
                <div className={cn("font-bold", toneText[tone])}>{e.feasibility_label}</div>
                <p className="mt-1 text-sm text-card-foreground">{e.rationale}</p>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estimated price
              </div>
              <div className="font-numeric mt-1 text-4xl font-extrabold text-rust sm:text-5xl">
                {usd(pr.low)} – {usd(pr.high)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {pr.quantity} × {pr.unit} · {e.region ?? p.region}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium" />
                    <th className="px-3 py-2 text-right font-medium">Low</th>
                    <th className="px-3 py-2 text-right font-medium">High</th>
                  </tr>
                </thead>
                <tbody className="font-numeric">
                  <tr className="border-t">
                    <td className="px-3 py-2 font-sans">Materials</td>
                    <td className="px-3 py-2 text-right">{usd(pr.materials[0])}</td>
                    <td className="px-3 py-2 text-right">{usd(pr.materials[1])}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 font-sans">Labour</td>
                    <td className="px-3 py-2 text-right">{usd(pr.labour[0])}</td>
                    <td className="px-3 py-2 text-right">{usd(pr.labour[1])}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">{multipliersText(pr.multipliers)}</p>

            <Badge variant={pr.calibration.applied ? "success" : "highlight"} className="py-1 font-medium">
              Local accuracy: {calibrationText(pr.calibration)}
            </Badge>

            <div className="grid gap-5 sm:grid-cols-2">
              <List icon={Wrench} title="Scope" items={e.scope} />
              <List icon={Package} title="Materials" items={e.materials} />
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 text-rust" />
                Typical timeline: <strong>{e.timeline_days} days</strong>
              </p>
              {e.verify_on_site.length > 0 && (
                <p className="flex gap-2">
                  <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-rust" />
                  <span>
                    <strong>Contractor will confirm:</strong> {e.verify_on_site.join(" · ")}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="onDark" size="xl" onClick={p.onBack}>
          <ArrowLeft /> Try another option
        </Button>
        <Button size="xl" className="flex-1 sm:flex-none" onClick={p.onContinue}>
          Get contracts <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
