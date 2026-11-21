// Models, pricing and tuning constants for SnapQuote.

export const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
export const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const INPAINT_MODEL = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
export const IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

// Demo price book (CAD/USD-agnostic, per unit). Replace with real regional data.
export const PRICE_BOOK = {
  window:   { unit: 'window',                     material: [350, 900],   labour: [150, 350] },
  door:     { unit: 'door',                       material: [400, 1800],  labour: [250, 600] },
  roof:     { unit: 'roof section (~100 sq ft)',  material: [250, 550],   labour: [200, 450] },
  cabinet:  { unit: 'cabinet run (linear ft)',    material: [150, 500],   labour: [80, 200] },
  hvac:     { unit: 'unit',                       material: [2500, 6000], labour: [800, 2000] },
  siding:   { unit: 'wall section (~100 sq ft)',  material: [300, 800],   labour: [250, 500] },
  flooring: { unit: 'room (~150 sq ft)',          material: [450, 1500],  labour: [400, 900] },
  fence:    { unit: 'fence section (8 ft)',       material: [120, 400],   labour: [80, 200] },
  other:    { unit: 'item',                       material: [200, 1000],  labour: [150, 600] },
};
export const REGIONS = {
  'Cleveland, OH': 0.92,
  'Waterloo, ON': 1.0,
  'Ottawa, ON': 1.05,
  'Toronto, ON': 1.15,
  'Vancouver, BC': 1.25,
  'New York, NY': 1.35,
};
export const CONDITION = { good: 1.0, fair: 1.08, poor: 1.2 };
export const ITEM_TYPES = Object.keys(PRICE_BOOK);

// Signed contracts needed before a learned local price correction is applied.
export const CALIB_MIN_SAMPLES = 3;
