/**
 * SnapQuote — Visual Feasibility & Instant Quoting Bridge
 * Cloudflare Worker JSON API. The front end lives in Lovable (see /frontend).
 *
 * Bindings (Worker > Settings > Bindings):
 *   AI    -> Workers AI            (required)
 *   JOBS  -> KV namespace           (recommended; without it jobs live in memory and can vanish)
 *
 * AI pipeline:
 *   Stage 1  Vision analysis      @cf/meta/llama-3.2-11b-vision-instruct  -> structured JSON
 *   Stage 2  Visualization        @cf/runwayml/stable-diffusion-v1-5-inpainting (masked)
 *                                 @cf/runwayml/stable-diffusion-v1-5-img2img   (no mask fallback)
 *   Stage 3  Feasibility + scope  @cf/meta/llama-3.3-70b-instruct-fp8-fast, priced by a deterministic price book
 */

const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const INPAINT_MODEL = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
const IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

// Demo price book (CAD/USD-agnostic, per unit). Replace with real regional data.
const PRICE_BOOK = {
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
const REGIONS = {
  'Cleveland, OH': 0.92,
  'Waterloo, ON': 1.0,
  'Ottawa, ON': 1.05,
  'Toronto, ON': 1.15,
  'Vancouver, BC': 1.25,
  'New York, NY': 1.35,
};
const CONDITION = { good: 1.0, fair: 1.08, poor: 1.2 };
const ITEM_TYPES = Object.keys(PRICE_BOOK);

const MEM = new Map(); // fallback store when no KV binding
let ENV = {}; // set per request so json() can read ALLOWED_ORIGIN

export default {
  async fetch(request, env) {
    ENV = env;
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
      if (request.method === 'GET' && pathname === '/') {
        return json({ name: 'SnapQuote API', ok: true, docs: '/api/config' });
      }
      if (pathname.startsWith('/api/') && pathname !== '/api/config' && pathname !== '/api/jobs' && !env.AI && request.method === 'POST') {
        return json({ error: 'Workers AI binding missing. Add a binding named AI in Settings > Bindings.' }, 500);
      }
      if (request.method === 'GET' && pathname === '/api/config') {
        return json({ regions: Object.keys(REGIONS), storage: env.JOBS ? 'kv' : 'memory', ai: !!env.AI });
      }
      if (request.method === 'POST' && pathname === '/api/analyze') return analyze(request, env);
      if (request.method === 'POST' && pathname === '/api/estimate') return estimate(request, env);
      if (request.method === 'POST' && pathname === '/api/visualize') return visualize(request, env);
      if (request.method === 'POST' && pathname === '/api/jobs') return createJob(request, env);
      if (request.method === 'GET' && pathname === '/api/jobs') return listJobsRoute(env);

      const m = pathname.match(/^\/api\/jobs\/([a-z0-9-]+)(\/contract)?$/i);
      if (m && request.method === 'GET' && !m[2]) {
        const job = await getJob(env, m[1]);
        return job ? json({ job }) : json({ error: 'Job not found' }, 404);
      }
      if (m && request.method === 'POST' && m[2]) return sendContract(request, env, m[1]);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};

/* ---------------- Stage 1: vision analysis ---------------- */

async function analyze(request, env) {
  const { image } = await request.json();
  if (!image) return json({ error: 'Missing image' }, 400);
  const bytes = b64ToBytes(image);

  const prompt =
    'You are a home-renovation estimator. Look at the photo and return ONLY a JSON object, no prose, with these keys:\n' +
    '{"item_type": one of ' + JSON.stringify(ITEM_TYPES) + ',\n' +
    ' "item_label": short name of the main item to repair or replace,\n' +
    ' "material": current material,\n' +
    ' "condition": "good" | "fair" | "poor",\n' +
    ' "visible_issues": array of short strings,\n' +
    ' "quantity": integer count of units visible (e.g. number of windows),\n' +
    ' "approx_dimensions": string estimate such as "36 x 60 in",\n' +
    ' "structural_concern": true if rot, sagging, cracks or water damage suggest structural work,\n' +
    ' "replacement_options": array of exactly 3 objects {"name": short product name, "prompt": one-sentence visual description of the new item for an image generator}}';

  const res = await runVision(env, bytes, prompt);
  const detection = normalizeDetection(readJSON(res));
  return json({ detection });
}

async function runVision(env, bytes, prompt) {
  const input = {
    messages: [
      { role: 'system', content: 'You output strict JSON only.' },
      { role: 'user', content: prompt },
    ],
    image: Array.from(bytes),
    max_tokens: 900,
  };
  try {
    return await env.AI.run(VISION_MODEL, input);
  } catch (e) {
    // Llama 3.2 Vision requires a one-time license acceptance per account.
    if (String((e && e.message) || e).toLowerCase().includes('agree')) {
      await env.AI.run(VISION_MODEL, { prompt: 'agree' });
      return await env.AI.run(VISION_MODEL, input);
    }
    throw e;
  }
}

function normalizeDetection(d) {
  d = d || {};
  const type = ITEM_TYPES.includes(String(d.item_type).toLowerCase()) ? String(d.item_type).toLowerCase() : 'other';
  const cond = ['good', 'fair', 'poor'].includes(String(d.condition).toLowerCase()) ? String(d.condition).toLowerCase() : 'fair';
  let options = Array.isArray(d.replacement_options) ? d.replacement_options : [];
  options = options
    .filter((o) => o && (o.name || o.prompt))
    .slice(0, 3)
    .map((o) => ({ name: String(o.name || o.prompt).slice(0, 80), prompt: String(o.prompt || o.name).slice(0, 300) }));
  if (!options.length) {
    options = [{ name: 'Modern replacement', prompt: 'a brand-new modern ' + (d.item_label || type) + ', clean finish' }];
  }
  return {
    item_type: type,
    item_label: String(d.item_label || type).slice(0, 80),
    material: String(d.material || 'unknown').slice(0, 60),
    condition: cond,
    visible_issues: Array.isArray(d.visible_issues) ? d.visible_issues.slice(0, 6).map(String) : [],
    quantity: clampInt(d.quantity, 1, 50),
    approx_dimensions: String(d.approx_dimensions || 'not measurable from photo').slice(0, 60),
    structural_concern: d.structural_concern === true || d.structural_concern === 'true',
    replacement_options: options,
  };
}

/* ---------------- Stage 2: visualization ---------------- */

async function visualize(request, env) {
  const { image, mask, prompt } = await request.json();
  if (!image || !prompt) return json({ error: 'Missing image or prompt' }, 400);
  const fullPrompt = prompt + ', photorealistic, installed in place, same lighting and camera angle, high detail';
  const negative = 'blurry, distorted, cartoon, painting, text, watermark, extra objects';

  let out;
  if (mask) {
    out = await env.AI.run(INPAINT_MODEL, {
      prompt: fullPrompt,
      negative_prompt: negative,
      image: Array.from(b64ToBytes(image)),
      mask: Array.from(b64ToBytes(mask)),
      width: 512,
      height: 512,
      num_steps: 20,
      strength: 1,
      guidance: 7.5,
    });
  } else {
    out = await env.AI.run(IMG2IMG_MODEL, {
      prompt: fullPrompt,
      negative_prompt: negative,
      image: Array.from(b64ToBytes(image)),
      width: 512,
      height: 512,
      num_steps: 20,
      strength: 0.55,
      guidance: 7.5,
    });
  }
  const buf = new Uint8Array(await new Response(out).arrayBuffer());
  return json({ image: 'data:image/png;base64,' + bytesToB64(buf), mode: mask ? 'inpaint' : 'img2img' });
}

/* ---------------- Stage 3: feasibility + price ---------------- */

async function estimate(request, env) {
  const { detection, option, region } = await request.json();
  if (!detection || !option) return json({ error: 'Missing detection or option' }, 400);
  const det = normalizeDetection(detection);
  const price = priceJob(det, region);

  const prompt =
    'You are a licensed renovation contractor writing a pre-inspection feasibility summary.\n' +
    'Photo analysis: ' + JSON.stringify(det) + '\n' +
    'Chosen replacement: ' + JSON.stringify(option) + '\n' +
    'Region: ' + (region || 'unknown') + '\n' +
    'Price range already computed from our price book: $' + price.low + ' - $' + price.high + ' for ' + price.quantity + ' ' + price.unit + '(s).\n' +
    'Return ONLY JSON with keys:\n' +
    '{"feasibility_score": integer 1-10 (10 = simple like-for-like swap, low = structural work needed),\n' +
    ' "feasibility_label": short phrase,\n' +
    ' "rationale": one or two sentences,\n' +
    ' "scope": array of 3-6 work steps,\n' +
    ' "materials": array of 3-6 material line items,\n' +
    ' "timeline_days": integer,\n' +
    ' "verify_on_site": array of 1-3 things the contractor must confirm before signing}';

  const res = await env.AI.run(TEXT_MODEL, {
    messages: [
      { role: 'system', content: 'You output strict JSON only.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
  });
  const ai = readJSON(res) || {};

  let score = clampInt(ai.feasibility_score, 1, 10);
  if (det.structural_concern) score = Math.min(score, 6); // rule: structural flags cap the score

  return json({
    estimate: {
      feasibility_score: score,
      feasibility_label: String(ai.feasibility_label || (score >= 8 ? 'Straightforward replacement' : score >= 5 ? 'Moderate complexity' : 'Structural work likely')),
      rationale: String(ai.rationale || ''),
      scope: arr(ai.scope),
      materials: arr(ai.materials),
      timeline_days: clampInt(ai.timeline_days, 1, 90),
      verify_on_site: arr(ai.verify_on_site),
      price,
      region: region || null,
    },
  });
}

function priceJob(det, region) {
  const book = PRICE_BOOK[det.item_type] || PRICE_BOOK.other;
  const qty = clampInt(det.quantity, 1, 50);
  const r = REGIONS[region] || 1;
  const c = CONDITION[det.condition] || 1.08;
  const s = det.structural_concern ? 1.35 : 1;
  const mult = r * c * s;
  const mat = [book.material[0] * qty * mult, book.material[1] * qty * mult].map(round50);
  const lab = [book.labour[0] * qty * mult, book.labour[1] * qty * mult].map(round50);
  return {
    low: mat[0] + lab[0],
    high: mat[1] + lab[1],
    materials: mat,
    labour: lab,
    unit: book.unit,
    quantity: qty,
    multipliers: { region: r, condition: c, structural: s },
  };
}

/* ---------------- Jobs: $49 verification + contractor contracts ---------------- */

async function createJob(request, env) {
  const b = await request.json();
  if (!b.detection || !b.estimate || !b.before) return json({ error: 'Incomplete plan' }, 400);
  const job = {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    customer: { name: String(b.name || 'Homeowner').slice(0, 60), email: String(b.email || '').slice(0, 80) },
    region: b.region || null,
    detection: b.detection,
    option: b.option,
    estimate: b.estimate,
    before: b.before,
    after: b.after || null,
    payment: { amount: 49, status: 'paid (demo)' }, // swap for Stripe Checkout in production
    status: 'awaiting_contract',
    contract: null,
  };
  await saveJob(env, job);
  return json({ job: { id: job.id, status: job.status } });
}

async function sendContract(request, env, id) {
  const job = await getJob(env, id);
  if (!job) return json({ error: 'Job not found' }, 404);
  const b = await request.json();
  const price = Number(b.price);
  if (!price || price <= 0) return json({ error: 'Enter a valid contract price' }, 400);
  job.contract = {
    company: String(b.company || 'Partner contractor').slice(0, 80),
    price: Math.round(price),
    note: String(b.note || '').slice(0, 500),
    sentAt: new Date().toISOString(),
  };
  job.status = 'contract_sent';
  await saveJob(env, job);
  return json({ job });
}

async function listJobsRoute(env) {
  const jobs = await listJobs(env);
  const withContract = jobs.filter((j) => j.contract && j.estimate && j.estimate.price);
  // Estimate-to-contract calibration: how far photo estimates sit from signed prices.
  const deltas = withContract.map((j) => {
    const mid = (j.estimate.price.low + j.estimate.price.high) / 2;
    return (j.contract.price - mid) / mid;
  });
  const avg = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  return json({
    jobs,
    stats: {
      total: jobs.length,
      contracts: withContract.length,
      fees: jobs.length * 49,
      avgDeltaPct: avg === null ? null : Math.round(avg * 1000) / 10,
    },
  });
}

async function saveJob(env, job) {
  if (env.JOBS) await env.JOBS.put('job:' + job.id, JSON.stringify(job));
  else MEM.set(job.id, job);
}
async function getJob(env, id) {
  if (env.JOBS) return await env.JOBS.get('job:' + id, 'json');
  return MEM.get(id) || null;
}
async function listJobs(env) {
  let jobs;
  if (env.JOBS) {
    const list = await env.JOBS.list({ prefix: 'job:' });
    jobs = (await Promise.all(list.keys.map((k) => env.JOBS.get(k.name, 'json')))).filter(Boolean);
  } else {
    jobs = Array.from(MEM.values());
  }
  return jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* ---------------- helpers ---------------- */

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(ENV) },
  });
}
function readJSON(res) {
  if (!res) return null;
  const r = res.response !== undefined ? res.response : res;
  if (r && typeof r === 'object') return r;
  const text = String(r || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
function arr(v) {
  return Array.isArray(v) ? v.slice(0, 8).map(String) : [];
}
function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function round50(n) {
  return Math.round(n / 50) * 50;
}
function b64ToBytes(dataUrl) {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
