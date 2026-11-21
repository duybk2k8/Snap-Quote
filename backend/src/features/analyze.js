// Stage 1: vision analysis with Llama 3.2 Vision -> structured detection JSON.

import { VISION_MODEL, ITEM_TYPES } from '../config.js';
import { json, readJSON, clampInt, b64ToBytes } from '../lib/utils.js';
import { getLocalContext } from './insights.js';

export async function analyze(request, env) {
  const { image, region } = await request.json();
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

  // Learned from paid jobs in this area: surface what local homeowners actually bought.
  const local = region ? await getLocalContext(env, detection.item_type, region) : null;
  if (local && local.popularOptions.length) {
    const top = local.popularOptions[0];
    const lower = (s) => String(s).toLowerCase();
    const match = detection.replacement_options.find((o) => lower(o.name) === lower(top.name));
    if (match) match.localFavorite = top.count;
    else
      detection.replacement_options = [
        { name: top.name, prompt: 'a new ' + top.name + ', installed in place', localFavorite: top.count },
        ...detection.replacement_options,
      ].slice(0, 4);
  }
  return json({ detection, local });
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

export function normalizeDetection(d) {
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
