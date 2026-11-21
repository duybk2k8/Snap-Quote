// Stage 2: visualization with Stable Diffusion (inpainting with a mask, img2img without).

import { INPAINT_MODEL, IMG2IMG_MODEL } from '../config.js';
import { json, b64ToBytes, bytesToB64 } from '../lib/utils.js';

export async function visualize(request, env) {
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
