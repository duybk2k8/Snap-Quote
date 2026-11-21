import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Camera, Eraser, ImageUp, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { createMaskPainter, fileToSquareJpeg, SIZE } from "@/lib/image-tools";

export type MaskPainter = ReturnType<typeof createMaskPainter>;

interface Props {
  image: string | null;
  onImage: (img: string) => void;
  region: string;
  onRegion: (r: string) => void;
  regions: string[];
  regionsLoading: boolean;
  painterRef: MutableRefObject<MaskPainter | null>;
  analyzing: boolean;
  onAnalyze: () => void;
}

export function UploadStep(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [brush, setBrush] = useState(26);
  const brushRef = useRef(brush);
  brushRef.current = brush;

  const { image, painterRef } = p;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const painter = createMaskPainter(canvas, () => brushRef.current);
    painterRef.current = painter;
    return () => {
      painter.destroy();
      if (painterRef.current === painter) painterRef.current = null;
    };
  }, [image, painterRef]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      p.onImage(await fileToSquareJpeg(file));
    } catch {
      toast.error("Could not read that image. Try a JPG or PNG photo.");
    }
  };

  return (
    <Card className="shadow-card">
      <CardContent className="flex flex-col items-center space-y-6 p-5 text-center sm:p-6">
        <div>
          <h2 className="text-2xl font-extrabold">Snap the part you want replaced</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A window, door, cabinet, fence… one clear photo is enough.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {!image ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mx-auto flex aspect-square w-full max-w-[512px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input bg-muted text-muted-foreground transition-colors hover:border-primary hover:bg-highlight hover:text-highlight-foreground"
          >
            <ImageUp className="size-10" />
            <span className="font-semibold">Tap to choose a photo</span>
            <span className="text-xs">JPG or PNG · cropped to a square</span>
          </button>
        ) : (
          <div className="w-full max-w-[512px] space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
              <img src={image} alt="Your photo" className="absolute inset-0 size-full object-cover" />
              <canvas
                ref={canvasRef}
                width={SIZE}
                height={SIZE}
                className="absolute inset-0 size-full cursor-crosshair opacity-45"
                aria-label="Paint over the area to replace"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Optional: paint over the part to replace for a precise preview.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex min-w-48 flex-1 items-center gap-3">
                <Label className="shrink-0 text-xs text-muted-foreground">Brush</Label>
                <Slider min={6} max={70} step={1} value={[brush]} onValueChange={(v) => setBrush(v[0] ?? 26)} />
                <span className="font-numeric w-8 text-right text-sm">{brush}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => p.painterRef.current?.reset()}>
                <Eraser /> Clear paint
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => camRef.current?.click()} className="sm:hidden">
            <Camera /> Take photo
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageUp /> {image ? "Change photo" : "Choose file"}
          </Button>
        </div>

        <div className="w-full max-w-sm space-y-2 text-left">
          <Label>Your region</Label>
          <Select value={p.region} onValueChange={p.onRegion} disabled={p.regionsLoading}>
            <SelectTrigger>
              <SelectValue placeholder={p.regionsLoading ? "Loading regions…" : "Select your region"} />
            </SelectTrigger>
            <SelectContent>
              {p.regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="xl" className="w-full sm:w-auto" disabled={!image || !p.region || p.analyzing} onClick={p.onAnalyze}>
          {p.analyzing ? <Loader2 className="animate-spin" /> : <ScanSearch />}
          {p.analyzing ? "Analyzing…" : "Analyze photo"}
        </Button>
      </CardContent>
    </Card>
  );
}
