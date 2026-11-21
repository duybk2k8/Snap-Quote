// Data moat: anonymous learning from signed contracts and accepted jobs.

import { CALIB_MIN_SAMPLES } from '../config.js';
import { json, clampNum } from '../lib/utils.js';
import { getData, putData, listData } from '../lib/storage.js';

function calibKey(type, region) {
  return 'calib:' + (type || 'other') + '|' + (region || 'unknown');
}

export async function getCalibration(env, type, region) {
  const c = await getData(env, calibKey(type, region));
  if (!c || !c.n) return { samples: 0, factor: 1 };
  return { samples: c.n, factor: clampNum(c.sumRatio / c.n, 0.7, 1.4) };
}

export async function addCalibrationSample(env, type, region, ratio) {
  if (!isFinite(ratio) || ratio <= 0) return;
  const key = calibKey(type, region);
  const c = (await getData(env, key)) || { n: 0, sumRatio: 0 };
  c.n += 1;
  c.sumRatio += clampNum(ratio, 0.3, 3);
  c.updated = new Date().toISOString();
  await putData(env, key, c);
}

export async function insights(env) {
  const records = await listData(env, 'data:');
  const calibs = await listData(env, 'calib:', true);

  // Estimate-to-contract calibration per item type + region
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

  // Visual-to-conversion: which visualized replacements turn into accepted jobs
  const byOption = {};
  for (const r of records) {
    const k = (r.item_type || 'other') + ' · ' + (r.option || 'custom');
    const o = (byOption[k] = byOption[k] || { option: r.option, item_type: r.item_type, plans: 0, contracts: 0, accepted: 0 });
    o.plans += 1;
    if (r.contract_price) o.contracts += 1;
    if (r.accepted) o.accepted += 1;
  }
  const options = Object.values(byOption)
    .map((o) => ({ ...o, acceptRate: o.plans ? Math.round((o.accepted / o.plans) * 100) : 0 }))
    .sort((a, b) => b.acceptRate - a.acceptRate || b.plans - a.plans);

  const total = records.length;
  const contracts = records.filter((r) => r.contract_price).length;
  const accepted = records.filter((r) => r.accepted).length;
  return json({
    totals: {
      plans: total,
      contracts,
      accepted,
      conversionPct: total ? Math.round((accepted / total) * 100) : 0,
    },
    calibration,
    options,
    minSamples: CALIB_MIN_SAMPLES,
  });
}
