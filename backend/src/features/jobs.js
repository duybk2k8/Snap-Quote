// Jobs: free repair requests -> company finalizes a contract -> homeowner pays
// repair price + quote fee. Only paid (finalized) jobs feed the anonymous learning data.

import { json } from '../lib/utils.js';
import { saveJob, getJob, listJobs } from '../lib/storage.js';
import { recordCompletedJobData } from './insights.js';
import { getCompany } from './companies.js';
import { quoteFeeFor, splitQuoteFee, getCompletedJobs, recordCompletedJob } from './billing.js';

/** POST /api/jobs : homeowner sends a free request to a company (no payment yet). */
export async function createJob(request, env) {
  const b = await request.json();
  if (!b.detection || !b.estimate || !b.before) return json({ error: 'Incomplete plan' }, 400);
  const email = String(b.email || '').trim().slice(0, 80);
  if (!email || !email.includes('@')) return json({ error: 'Enter a valid email so the company can send your contract' }, 400);

  const company = b.company ? await getCompany(env, b.company) : null;
  if (b.company && !company) return json({ error: 'Company not found' }, 404);

  const quoteFee = quoteFeeFor(await getCompletedJobs(env, email));
  const job = {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    company: company ? { slug: company.slug, name: company.name } : null,
    customer: { name: String(b.name || 'Homeowner').slice(0, 60), email },
    region: b.region || null,
    detection: b.detection,
    option: b.option,
    estimate: b.estimate,
    before: b.before,
    after: b.after || null,
    quoteFeePreview: quoteFee, // what the homeowner will pay as quote fee if they go ahead
    status: 'requested',
    contract: null,
    billing: null,
  };
  await saveJob(env, job);
  return json({ job: { id: job.id, status: job.status, quoteFee } });
}

/** POST /api/jobs/:id/contract : the company finalizes the contract with the repair price. */
export async function sendContract(request, env, id) {
  const job = await getJob(env, id);
  if (!job) return json({ error: 'Job not found' }, 404);
  if (job.status === 'paid') return json({ error: 'This job is already paid' }, 400);
  const b = await request.json();
  const repairPrice = Math.round(Number(b.repairPrice ?? b.price));
  if (!repairPrice || repairPrice <= 0) return json({ error: 'Enter a valid repair price' }, 400);

  // Quote fee is fixed at contract time from the homeowner's loyalty level.
  const qf = quoteFeeFor(await getCompletedJobs(env, job.customer.email));
  job.contract = {
    company: (job.company && job.company.name) || String(b.company || 'Partner company').slice(0, 80),
    repairPrice,
    quoteFee: qf.fee,
    discountPct: qf.discountPct,
    total: Math.round((repairPrice + qf.fee) * 100) / 100,
    note: String(b.note || '').slice(0, 500),
    sentAt: new Date().toISOString(),
  };
  job.status = 'contract_sent';
  await saveJob(env, job);
  return json({ job });
}

/** POST /api/jobs/:id/pay (alias /accept) : homeowner accepts and pays repair + quote fee (demo). */
export async function payContract(env, id) {
  const job = await getJob(env, id);
  if (!job) return json({ error: 'Job not found' }, 404);
  if (!job.contract) return json({ error: 'No contract to pay yet' }, 400);
  if (job.status === 'paid') return json({ job });

  const split = splitQuoteFee(job.contract.quoteFee);
  job.billing = {
    repairPrice: job.contract.repairPrice,
    quoteFee: job.contract.quoteFee,
    total: job.contract.total,
    platformCommission: split.platform, // SnapQuote's share of the quote fee
    companyPayout: Math.round((job.contract.repairPrice + split.company) * 100) / 100,
    commissionPct: split.commissionPct,
    method: 'demo', // production: Stripe Connect, with the commission as the application fee
    paidAt: new Date().toISOString(),
  };
  job.status = 'paid';
  await saveJob(env, job);

  // Loyalty: this completed repair lowers the homeowner's next quote fee.
  const completed = await recordCompletedJob(env, job.customer.email);
  job.nextQuoteFee = quoteFeeFor(completed);
  await saveJob(env, job);

  // Only now does the job become anonymous learning data for future estimates.
  await recordCompletedJobData(env, job);
  return json({ job });
}

/** GET /api/jobs[?company=slug] : company dashboard. */
export async function listJobsRoute(url, env) {
  const slug = url.searchParams.get('company');
  let jobs = await listJobs(env);
  if (slug) jobs = jobs.filter((j) => j.company && j.company.slug === slug);

  const contracts = jobs.filter((j) => j.contract);
  const paid = jobs.filter((j) => j.status === 'paid' && j.billing);
  const sum = (arr, f) => Math.round(arr.reduce((s, j) => s + f(j), 0) * 100) / 100;

  // Estimate-to-contract gap on finalized jobs.
  const deltas = contracts
    .filter((j) => j.estimate && j.estimate.price)
    .map((j) => {
      const mid = (j.estimate.price.low + j.estimate.price.high) / 2;
      return (j.contract.repairPrice - mid) / mid;
    });
  const avg = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

  return json({
    jobs,
    stats: {
      requests: jobs.length,
      contracts: contracts.length,
      paid: paid.length,
      repairRevenue: sum(paid, (j) => j.billing.repairPrice),
      quoteFees: sum(paid, (j) => j.billing.quoteFee),
      platformCommission: sum(paid, (j) => j.billing.platformCommission),
      companyPayout: sum(paid, (j) => j.billing.companyPayout),
      avgDeltaPct: avg === null ? null : Math.round(avg * 1000) / 10,
    },
  });
}
