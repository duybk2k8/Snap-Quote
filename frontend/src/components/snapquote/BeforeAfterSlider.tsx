import { useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

export function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full cursor-ew-resize select-none overflow-hidden rounded-lg bg-muted"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
        if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
      }}
    >
      <img src={after} alt="After: AI preview" className="absolute inset-0 size-full object-cover" draggable={false} />
      <img
        src={before}
        alt="Before: your photo"
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <span className="absolute left-3 top-3 rounded bg-header/80 px-2 py-1 text-xs font-semibold text-header-foreground">
        Before
      </span>
      <span className="absolute right-3 top-3 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
        After
      </span>
      <div className="absolute inset-y-0 w-0.5 bg-primary-foreground shadow" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-primary-foreground bg-primary text-primary-foreground shadow-lg">
          <MoveHorizontal className="size-4" />
        </span>
      </div>
    </div>
  );
}
