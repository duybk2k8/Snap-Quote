/**
 * SnapQuote — Visual Feasibility & Instant Quoting Bridge
 * Cloudflare Worker JSON API. The front end lives in Lovable (see /frontend).
 *
 * Business model: homeowners quote for free and send a free request to a company.
 * When the company finalizes the contract, the homeowner pays repair price + $25 quote
 * fee (10% off per completed repair). SnapQuote keeps 20% of the quote fee; companies
 * also pay a fixed monthly plan. Only paid jobs become anonymous learning data.
 *
 * Layout:
 *   index.js            router (this file)
 *   config.js           models, price book, regions
 *   features/*.js       one file per feature (analyze, visualize, estimate, jobs,
 *                       billing, companies, insights)
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
import { createJob, sendContract, payContract, listJobsRoute } from './features/jobs.js';
import { insights } from './features/insights.js';
import { createCompany, listCompaniesRoute, getCompanyRoute } from './features/companies.js';
import { quoteFeeRoute } from './features/billing.js';
import {
  QUOTE_FEE,
  LOYALTY_DISCOUNT,
  QUOTE_FEE_FLOOR,
  PLATFORM_COMMISSION,
  COMPANY_PLAN_FEE,
} from './config.js';

const AI_ROUTES = ['/api/analyze', '/api/visualize', '/api/estimate'];

export default {
  async fetch(request, env) {
    setEnv(env);
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    try {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
      if (method === 'GET' && pathname === '/') return json({ name: 'SnapQuote API', ok: true, docs: '/api/config' });
      if (AI_ROUTES.includes(pathname) && !env.AI) {
        return json({ error: 'Workers AI binding missing. Add a binding named AI in wrangler.toml.' }, 500);
      }

      if (method === 'GET' && pathname === '/api/config') {
        return json({
          regions: Object.keys(REGIONS),
          storage: env.JOBS ? 'kv' : 'memory',
          ai: !!env.AI,
          pricing: {
            quoteFee: QUOTE_FEE,
            loyaltyDiscountPct: Math.round(LOYALTY_DISCOUNT * 100),
            quoteFeeFloor: QUOTE_FEE_FLOOR,
            platformCommissionPct: Math.round(PLATFORM_COMMISSION * 100),
            companyPlanFee: COMPANY_PLAN_FEE,
          },
        });
      }

      // Free quoting (AI pipeline)
      if (method === 'POST' && pathname === '/api/analyze') return await analyze(request, env);
      if (method === 'POST' && pathname === '/api/visualize') return await visualize(request, env);
      if (method === 'POST' && pathname === '/api/estimate') return await estimate(request, env);

      // Companies and billing
      if (method === 'POST' && pathname === '/api/companies') return await createCompany(request, env);
      if (method === 'GET' && pathname === '/api/companies') return await listCompaniesRoute(env);
      const c = pathname.match(/^\/api\/companies\/([a-z0-9-]+)$/i);
      if (c && method === 'GET') return await getCompanyRoute(env, c[1]);
      if (method === 'GET' && pathname === '/api/quote-fee') return await quoteFeeRoute(url, env);

      // Requests, contracts, payment
      if (method === 'POST' && pathname === '/api/jobs') return await createJob(request, env);
      if (method === 'GET' && pathname === '/api/jobs') return await listJobsRoute(url, env);
      const m = pathname.match(/^\/api\/jobs\/([a-z0-9-]+)(\/contract|\/pay|\/accept)?$/i);
      if (m && method === 'GET' && !m[2]) {
        const job = await getJob(env, m[1]);
        return job ? json({ job }) : json({ error: 'Job not found' }, 404);
      }
      if (m && method === 'POST' && m[2] === '/contract') return await sendContract(request, env, m[1]);
      if (m && method === 'POST' && (m[2] === '/pay' || m[2] === '/accept')) return await payContract(env, m[1]);

      // Learning data
      if (method === 'GET' && pathname === '/api/insights') return await insights(env);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};
