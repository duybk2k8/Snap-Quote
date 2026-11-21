// Data moat: anonymous learning from FINALIZED jobs only (request sent, contract
// finalized, homeowner paid). No names, emails or photos are stored here.
//
// Keys:
//   data:<jobId>                 one anonymous record per paid job
//   calib:<item_type>|<region>   running estimate-to-contract ratio for that area
//
// Future estimates use this data in two ways:
//   1. price correction: estimates in an area with >= CALIB_MIN_SAMPLES paid jobs are
//      multiplied by the learned ratio (features/estimate.js)
//   2. local context for generation: the most-bought options and typical paid price in
//      the area are fed to the vision and estimate prompts (features/analyze.js, estimate.js)

import { CALIB_MIN_SAMPLES } from '../config.js';
import { json, clampNum } from '../lib/utils.js';
import { getData, putData, listData, listJobs } from '../lib/storage.js';

function calibKey(type, region) {
  return 'calib:' + (type || 'other') + '|' + (region || 'unknown');
}

export async function getCalibration(env, type, region) {
  const c = await getData(env, calibKey(type, region));
  if (!c || !c.n) return { samples: 0, factor: 1 };
  return { samples: c.n, factor: clampNum(c.sumRatio / c.n, 0.7, 1.4) };
}

async function addCalibrationSample(env, type, region, ratio) {
  if (!isFinite(ratio) || ratio <= 0) return;
  const key = calibKey(type, region);
  const c = (await getData(env, key)) || { n: 0, sumRatio: 0 };
  c.n += 1;
  c.sumRatio += clampNum(ratio, 0.3, 3);
  c.updated = new Date().toISOString();
  await putData(env, key, c);
}

/** Called once, when a job is paid. Writes the anonymous record and the calibration sample. */
export async function recordCompletedJobData(env, job) {
  const d = job.detection || {};
  const p = (job.estimate && job.estimate.price) || {};
  await putData(env, 'data:' + job.id, {
    item_type: d.item_type || 'other',
    region: job.region,
    condition: d.condition,
    quantity: d.quantity,
    structural_concern: !!d.structural_concern,
    option: (job.option && job.option.name) || 'custom',
    est_low: p.low,
    est_high: p.high,
    repair_price: job.billing.repairPrice,
    paid_at: job.billing.paidAt,
  });
  if (p.low && p.high) {
    // Compare against the uncorrected estimate so corrections don't compound.
    const learnedUsed = (p.multipliers && p.multipliers.learned) || 1;
    const rawMid = (p.low + p.high) / 2 / learnedUsed;
    await addCalibrationSample(env, d.item_type, job.region, job.billing.repairPrice / rawMid);
  }
}

/** Local context for generation: what homeowners in this area actually paid for. */
export async function getLocalContext(env, itemType, region) {
  const records = (await listData(env, 'data:')).filter(
    (r) => r.region === region && (!itemType || r.item_type === itemType),
  );
  if (!records.length) return { completedJobs: 0, popularOptions: [], avgPaidPrice: null };
  const counts = {};
  for (const r of records) counts[r.option] = (counts[r.option] || 0) + 1;
  const popularOptions = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
  const avgPaidPrice = Math.round(records.reduce((s, r) => s + (r.repair_price || 0), 0) / records.length);
  return { completedJobs: records.length, popularOptions, avgPaidPrice };
}

/** GET /api/insights : what the learning data looks like (for the insights page). */
export async function insights(env) {
  const records = await listData(env, 'data:');
  const calibs = await listData(env, 'calib:', true);
  const jobs = await listJobs(env);

  const calibration = calibs
    .map(({ key, value }) => {
      const [type, region] = key.slice(6).split('|');
      const factor = value.n ? value.sumRatio / value.n : 1;
      return {
        item_type: type,
        region,
        samples: value.n,
        factor: Math.round(clampNum(factor, 0.7, 1.4) * 100) / 100,
        active: value.n >= CALIB_MIN_SAMPLES,
      };
    })
    .sort((a, b) => b.samples - a.samples);

  // What homeowners actually buy, from paid jobs only.
  const byOption = {};
  for (const r of records) {
    const k = (r.item_type || 'other') + ' · ' + (r.option || 'custom');
    const o = (byOption[k] = byOption[k] || { option: r.option, item_type: r.item_type, completed: 0, totalPaid: 0 });
    o.completed += 1;
    o.totalPaid += r.repair_price || 0;
  }
  const options = Object.values(byOption)
    .map((o) => ({ option: o.option, item_type: o.item_type, completed: o.completed, avgPaidPrice: Math.round(o.totalPaid / o.completed) }))
    .sort((a, b) => b.completed - a.completed);

  // Funnel counts (no personal data leaves the jobs store).
  const requests = jobs.length;
  const contracts = jobs.filter((j) => j.contract).length;
  const paid = jobs.filter((j) => j.status === 'paid').length;

  return json({
    totals: {
      requests,
      contracts,
      paid,
      conversionPct: requests ? Math.round((paid / requests) * 100) : 0,
      learningRecords: records.length,
    },
    calibration,
    options,
    minSamples: CALIB_MIN_SAMPLES,
  });
}
