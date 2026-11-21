// Stage 3: deterministic price book (+ learned correction) and Llama 3.3 feasibility summary.

import { TEXT_MODEL, PRICE_BOOK, REGIONS, CONDITION, CALIB_MIN_SAMPLES } from '../config.js';
import { json, readJSON, arr, clampInt, round50 } from '../lib/utils.js';
import { normalizeDetection } from './analyze.js';
import { getCalibration, getLocalContext } from './insights.js';

export async function estimate(request, env) {
  const { detection, option, region } = await request.json();
  if (!detection || !option) return json({ error: 'Missing detection or option' }, 400);
  const det = normalizeDetection(detection);
  const calib = await getCalibration(env, det.item_type, region);
  const price = priceJob(det, region, calib);
  const local = await getLocalContext(env, det.item_type, region);
  const localLine = local.completedJobs
    ? 'Local data from ' + local.completedJobs + ' paid jobs for this item in ' + region + ': average paid price $' +
      local.avgPaidPrice + '; most chosen options: ' + local.popularOptions.map((o) => o.name + ' (' + o.count + ')').join(', ') + '.\n'
    : '';

  const prompt =
    'You are a licensed renovation contractor writing a pre-inspection feasibility summary.\n' +
    'Photo analysis: ' + JSON.stringify(det) + '\n' +
    'Chosen replacement: ' + JSON.stringify(option) + '\n' +
    'Region: ' + (region || 'unknown') + '\n' +
    'Price range already computed from our price book: $' + price.low + ' - $' + price.high + ' for ' + price.quantity + ' ' + price.unit + '(s).\n' +
    localLine +
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
      local,
      region: region || null,
    },
  });
}

export function priceJob(det, region, calib) {
  const book = PRICE_BOOK[det.item_type] || PRICE_BOOK.other;
  const qty = clampInt(det.quantity, 1, 50);
  const r = REGIONS[region] || 1;
  const c = CONDITION[det.condition] || 1.08;
  const s = det.structural_concern ? 1.35 : 1;
  // Learned local correction from past signed contracts (the data moat).
  const applied = !!(calib && calib.samples >= CALIB_MIN_SAMPLES);
  const learned = applied ? calib.factor : 1;
  const mult = r * c * s * learned;
  const mat = [book.material[0] * qty * mult, book.material[1] * qty * mult].map(round50);
  const lab = [book.labour[0] * qty * mult, book.labour[1] * qty * mult].map(round50);
  return {
    low: mat[0] + lab[0],
    high: mat[1] + lab[1],
    materials: mat,
    labour: lab,
    unit: book.unit,
    quantity: qty,
    multipliers: { region: r, condition: c, structural: s, learned: Math.round(learned * 100) / 100 },
    calibration: {
      applied,
      samples: calib ? calib.samples : 0,
      factor: calib ? Math.round(calib.factor * 100) / 100 : 1,
      needed: CALIB_MIN_SAMPLES,
    },
  };
}
