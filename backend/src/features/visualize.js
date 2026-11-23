// Stage 2: visualization.
// Tries, in order: inpainting (only the painted area, needs a mask) -> img2img (whole photo)
// -> text-to-image (last resort). Each failure is recorded so the front end can show why.

import { INPAINT_MODEL, IMG2IMG_MODEL, TEXT2IMG_MODEL } from '../config.js';
import { json, b64ToBytes, bytesToB64 } from '../lib/utils.js';

const NEGATIVE = 'blurry, distorted, cartoon, painting, text, watermark, extra objects';

// Models return either a stream of image bytes, raw bytes, or { image: base64 }.
async function toDataUrl(out) {
  if (out && typeof out === 'object' && typeof out.image === 'string') {
    return 'data:image/jpeg;base64,' + out.image;
  }
  const buf = new Uint8Array(await new Response(out).arrayBuffer());
  if (buf.length < 100) throw new Error('model returned an empty image');
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  return 'data:image/' + (isJpeg ? 'jpeg' : 'png') + ';base64,' + bytesToB64(buf);
}

export async function visualize(request, env) {
  const { image, mask, prompt } = await request.json();
  if (!image || !prompt) return json({ error: 'Missing image or prompt' }, 400);
  const fullPrompt = prompt + ', photorealistic, installed in place, same lighting and camera angle, high detail';
  const imageBytes = Array.from(b64ToBytes(image));

  const attempts = [];
  if (mask) {
    attempts.push({
      mode: 'inpaint',
      run: () =>
        env.AI.run(INPAINT_MODEL, {
          prompt: fullPrompt, negative_prompt: NEGATIVE, image: imageBytes,
          mask: Array.from(b64ToBytes(mask)), width: 512, height: 512, num_steps: 20, strength: 1, guidance: 7.5,
        }),
    });
  }
  attempts.push({
    mode: 'img2img',
    run: () =>
      env.AI.run(IMG2IMG_MODEL, {
        prompt: fullPrompt, negative_prompt: NEGATIVE, image: imageBytes,
        width: 512, height: 512, num_steps: 20, strength: 0.55, guidance: 7.5,
      }),
  });
  attempts.push({
    mode: 'generated',
    run: () => env.AI.run(TEXT2IMG_MODEL, { prompt: 'Photo of a house exterior showing ' + fullPrompt, steps: 6 }),
  });

  const errors = [];
  for (const a of attempts) {
    try {
      const url = await toDataUrl(await a.run());
      return json({ image: url, mode: a.mode, fallbacks: errors });
    } catch (e) {
      errors.push({ mode: a.mode, error: String((e && e.message) || e).slice(0, 300) });
    }
  }
  return json({ error: 'Image generation failed: ' + errors.map((e) => e.mode + ': ' + e.error).join(' | ') }, 502);
}
