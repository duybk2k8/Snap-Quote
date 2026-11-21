// Image helpers for SnapQuote. The models expect 512x512 inputs, and the
// inpainting mask must be the same size: white = area to replace, black = keep.

export const SIZE = 512;

/** Load a File, center-crop it to a square and return a 512x512 JPEG data URL. */
export function fileToSquareJpeg(file: File, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Mask painter. Attach it to a <canvas width=512 height=512> drawn on top of the photo
 * (style it with opacity ~0.45). The user paints red on screen; a hidden canvas keeps
 * the white-on-black mask the API needs.
 */
export function createMaskPainter(overlay: HTMLCanvasElement, getBrush: () => number = () => 26) {
  const octx = overlay.getContext("2d")!;
  const mask = document.createElement("canvas");
  mask.width = SIZE;
  mask.height = SIZE;
  const mctx = mask.getContext("2d")!;
  let painted = false;
  let drawing = false;

  const reset = () => {
    octx.clearRect(0, 0, SIZE, SIZE);
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, SIZE, SIZE);
    painted = false;
  };

  const dot = (e: PointerEvent) => {
    const r = overlay.getBoundingClientRect();
    const x = ((e.clientX - r.left) * SIZE) / r.width;
    const y = ((e.clientY - r.top) * SIZE) / r.height;
    const rad = getBrush();
    octx.fillStyle = "#ff2d2d";
    octx.beginPath(); octx.arc(x, y, rad, 0, Math.PI * 2); octx.fill();
    mctx.fillStyle = "#fff";
    mctx.beginPath(); mctx.arc(x, y, rad, 0, Math.PI * 2); mctx.fill();
    painted = true;
  };

  const down = (e: PointerEvent) => { drawing = true; overlay.setPointerCapture(e.pointerId); dot(e); };
  const move = (e: PointerEvent) => { if (drawing) dot(e); };
  const up = () => { drawing = false; };

  overlay.style.touchAction = "none";
  overlay.addEventListener("pointerdown", down);
  overlay.addEventListener("pointermove", move);
  overlay.addEventListener("pointerup", up);
  reset();

  return {
    reset,
    /** PNG data URL of the mask, or null if the user painted nothing. */
    getMask: (): string | null => (painted ? mask.toDataURL("image/png") : null),
    destroy: () => {
      overlay.removeEventListener("pointerdown", down);
      overlay.removeEventListener("pointermove", move);
      overlay.removeEventListener("pointerup", up);
    },
  };
}
