// Jobs: $49 verification (demo payment), contractor contracts, homeowner acceptance.

import { json } from '../lib/utils.js';
import { saveJob, getJob, getData, putData, listJobs } from '../lib/storage.js';
import { addCalibrationSample } from './insights.js';

export async function createJob(request, env) {
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
  // Anonymous learning record: no name, email or photos.
  await putData(env, 'data:' + job.id, {
    item_type: (job.detection && job.detection.item_type) || 'other',
    region: job.region,
    condition: job.detection && job.detection.condition,
    quantity: job.detection && job.detection.quantity,
    option: (job.option && job.option.name) || 'custom',
    est_low: job.estimate.price && job.estimate.price.low,
    est_high: job.estimate.price && job.estimate.price.high,
    contract_price: null,
    accepted: false,
    created: job.createdAt,
  });
  return json({ job: { id: job.id, status: job.status } });
}

export async function sendContract(request, env, id) {
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

  const rec = await getData(env, 'data:' + id);
  if (rec) {
    rec.contract_price = job.contract.price;
    await putData(env, 'data:' + id, rec);
  }
  const p = job.estimate && job.estimate.price;
  if (p && p.low && p.high) {
    // Compare against the uncorrected estimate so corrections don't compound.
    const learnedUsed = (p.multipliers && p.multipliers.learned) || 1;
    const rawMid = (p.low + p.high) / 2 / learnedUsed;
    await addCalibrationSample(env, job.detection.item_type, job.region, job.contract.price / rawMid);
  }
  return json({ job });
}

export async function acceptContract(env, id) {
  const job = await getJob(env, id);
  if (!job) return json({ error: 'Job not found' }, 404);
  if (!job.contract) return json({ error: 'No contract to accept yet' }, 400);
  job.status = 'accepted';
  job.acceptedAt = new Date().toISOString();
  await saveJob(env, job);
  const rec = await getData(env, 'data:' + id);
  if (rec) {
    rec.accepted = true;
    await putData(env, 'data:' + id, rec);
  }
  return json({ job });
}

export async function listJobsRoute(env) {
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
