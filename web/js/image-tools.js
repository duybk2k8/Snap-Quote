// image-tools.js — prepares the photo and the "paint the part to replace" mask.
// The AI models want a 512 x 512 image. The mask is the same size:
// white = the area to replace, black = keep as is.

const SIZE = 512;

// Draws the chosen photo into a canvas, cropped to a square, and returns a JPEG "data URL".
function drawSquarePhoto(file, canvas) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => reject(new Error("Could not read that image. Try a JPG or PNG."));
    img.src = URL.createObjectURL(file);
  });
}

// Lets the user paint on a see-through canvas. Returns { clear, getMask }.
function createMaskPainter(canvas, getBrushSize) {
  const screen = canvas.getContext("2d"); // what the user sees (red paint)
  const hidden = document.createElement("canvas"); // what we send (white on black)
  hidden.width = SIZE;
  hidden.height = SIZE;
  const mask = hidden.getContext("2d");
  let painting = false;
  let painted = false;

  function clear() {
    screen.clearRect(0, 0, SIZE, SIZE);
    mask.fillStyle = "#000";
    mask.fillRect(0, 0, SIZE, SIZE);
    painted = false;
  }

  function dot(event) {
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) * SIZE) / box.width;
    const y = ((event.clientY - box.top) * SIZE) / box.height;
    const r = getBrushSize();
    screen.fillStyle = "#ff2d2d";
    screen.beginPath(); screen.arc(x, y, r, 0, Math.PI * 2); screen.fill();
    mask.fillStyle = "#fff";
    mask.beginPath(); mask.arc(x, y, r, 0, Math.PI * 2); mask.fill();
    painted = true;
  }

  canvas.addEventListener("pointerdown", (e) => { painting = true; canvas.setPointerCapture(e.pointerId); dot(e); });
  canvas.addEventListener("pointermove", (e) => { if (painting) dot(e); });
  canvas.addEventListener("pointerup", () => { painting = false; });

  clear();
  return {
    clear,
    // PNG of the mask, or null if nothing was painted (the backend then restyles the whole photo).
    getMask: () => (painted ? hidden.toDataURL("image/png") : null),
  };
}
