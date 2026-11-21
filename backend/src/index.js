/**
 * SnapQuote — Visual Feasibility & Instant Quoting Bridge
 * Cloudflare Worker JSON API. The front end lives in Lovable (see /frontend).
 *
 * Layout:
 *   index.js            router (this file)
 *   config.js           models, price book, regions
 *   features/*.js       one file per feature (analyze, visualize, estimate, jobs, insights)
 *   lib/*.js            storage and shared helpers
 *
 * Bindings (declared in wrangler.toml):
 *   AI    -> Workers AI            (required)
 *   JOBS  -> KV namespace           (recommended; without it jobs live in memory and can vanish)
 *
 * AI pipeline:
 *   Stage 1  Vision analysis      @cf/meta/llama-3.2-11b-vision-instruct  -> structured JSON
 *   Stage 2  Visualization        @cf/runwayml/stable-diffusion-v1-5-inpainting (masked)
 *                                 @cf/runwayml/stable-diffusion-v1-5-img2img   (no mask fallback)
 *   Stage 3  Feasibility + scope  @cf/meta/llama-3.3-70b-instruct-fp8-fast, priced by a deterministic price book
 */

import { REGIONS } from './config.js';
import { json, corsHeaders, setEnv } from './lib/utils.js';
import { getJob } from './lib/storage.js';
import { analyze } from './features/analyze.js';
import { visualize } from './features/visualize.js';
import { estimate } from './features/estimate.js';
import { createJob, sendContract, acceptContract, listJobsRoute } from './features/jobs.js';
import { insights } from './features/insights.js';

export default {
  async fetch(request, env) {
    setEnv(env);
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

      if (request.method === 'GET' && pathname === '/api/insights') return insights(env);

      const m = pathname.match(/^\/api\/jobs\/([a-z0-9-]+)(\/contract|\/accept)?$/i);
      if (m && request.method === 'GET' && !m[2]) {
        const job = await getJob(env, m[1]);
        return job ? json({ job }) : json({ error: 'Job not found' }, 404);
      }
      if (m && request.method === 'POST' && m[2] === '/contract') return sendContract(request, env, m[1]);
      if (m && request.method === 'POST' && m[2] === '/accept') return acceptContract(env, m[1]);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};
