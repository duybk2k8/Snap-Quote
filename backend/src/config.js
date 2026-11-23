// Models, pricing and tuning constants for SnapQuote.

export const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
export const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const INPAINT_MODEL = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
export const IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';
// Last-resort text-to-image when both photo-editing models fail (inpainting was deprecated Nov 20, 2026).
export const TEXT2IMG_MODEL = '@cf/black-forest-labs/flux-1-schnell';

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

// ---------------- Business model ----------------
// Homeowners quote for free. When a company finalizes a contract, the homeowner pays
// the repair price + the quote fee. Each completed repair lowers that homeowner's next
// quote fee by 10% (compounding) down to a floor. SnapQuote keeps a commission on the
// quote fee; the rest goes to the company. Companies also pay a fixed monthly plan fee.
export const QUOTE_FEE = 25;
export const LOYALTY_DISCOUNT = 0.1;
export const QUOTE_FEE_FLOOR = 12.5;
export const PLATFORM_COMMISSION = 0.2;
export const COMPANY_PLAN_FEE = 1200;
