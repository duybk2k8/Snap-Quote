import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, FileSignature, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SnapQuote · Snap it. See it. Get it quoted!" },
      { name: "description", content: "Photograph a window, door or cabinet, preview the replacement with AI and get a local price range in a minute." },
      { property: "og:title", content: "SnapQuote · Snap it. See it. Get it quoted!" },
      { property: "og:description", content: "Photograph a window, door or cabinet, preview the replacement with AI and get a local price range in a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEPS = [
  { icon: Camera, title: "Snap", text: "Take one photo of what needs replacing." },
  { icon: ScanEye, title: "Preview & price", text: "See the new look and a local price range." },
  { icon: FileSignature, title: "Get contracts", text: "Local contractors send you a firm price." },
];

function Index() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:pb-20 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary bg-highlight px-3 py-1 text-xs font-semibold text-highlight-foreground">
          Windows · Doors · Cabinets · Roofs · Fences
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] sm:text-7xl">
          Snap it. See it.{" "}
          <span className="text-primary">Get it quoted!</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-page-muted">
          One photo gets you an AI preview of the replacement and an honest local price range, before anyone visits.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="xl">
            <Link to="/quote">
              Get a quote <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-page-border bg-header">
        <ol className="mx-auto grid max-w-6xl gap-px px-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4 py-7 sm:px-6 sm:first:pl-0">
              <span className="font-numeric text-5xl font-black leading-none text-primary">{i + 1}</span>
              <div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <s.icon className="size-5 text-primary" /> {s.title}
                </div>
                <p className="mt-1 text-sm text-page-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
