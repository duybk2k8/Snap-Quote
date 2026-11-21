import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-header text-header-foreground">
      <div className="hazard-stripe h-1 w-full" aria-hidden />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Camera className="size-4" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">
            Snap<span className="text-primary">Quote</span>
          </span>
        </Link>
        <Button asChild size="sm">
          <Link to="/quote">Get a quote</Link>
        </Button>
      </div>
    </header>
  );
}
