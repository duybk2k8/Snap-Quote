// Billing: quote fee, loyalty discount and the commission split.

import { QUOTE_FEE, LOYALTY_DISCOUNT, QUOTE_FEE_FLOOR, PLATFORM_COMMISSION } from '../config.js';
import { json } from '../lib/utils.js';
import { getData, putData } from '../lib/storage.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Quote fee after `completedJobs` paid repairs: $25 × 0.9^n, never below the floor. */
export function quoteFeeFor(completedJobs) {
  const n = Math.max(0, completedJobs | 0);
  const fee = Math.max(QUOTE_FEE_FLOOR, QUOTE_FEE * Math.pow(1 - LOYALTY_DISCOUNT, n));
  const next = Math.max(QUOTE_FEE_FLOOR, QUOTE_FEE * Math.pow(1 - LOYALTY_DISCOUNT, n + 1));
  return {
    fee: round2(fee),
    base: QUOTE_FEE,
    discountPct: Math.round((1 - fee / QUOTE_FEE) * 100),
    completedJobs: n,
    nextFee: round2(next),
    floor: QUOTE_FEE_FLOOR,
  };
}

/** Split a quote fee between SnapQuote and the company. */
export function splitQuoteFee(fee) {
  const platform = round2(fee * PLATFORM_COMMISSION);
  return { platform, company: round2(fee - platform), commissionPct: Math.round(PLATFORM_COMMISSION * 100) };
}

// Loyalty is tracked per homeowner by a SHA-256 hash of their email, so the
// learning store never holds the address itself.
async function customerKey(email) {
  const data = new TextEncoder().encode(String(email || '').trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return 'customer:' + hex;
}

export async function getCompletedJobs(env, email) {
  if (!email) return 0;
  const c = await getData(env, await customerKey(email));
  return (c && c.completedJobs) || 0;
}

export async function recordCompletedJob(env, email) {
  if (!email) return 0;
  const key = await customerKey(email);
  const c = (await getData(env, key)) || { completedJobs: 0 };
  c.completedJobs += 1;
  c.lastJobAt = new Date().toISOString();
  await putData(env, key, c);
  return c.completedJobs;
}

/** GET /api/quote-fee?email=... : what this homeowner will pay as quote fee right now. */
export async function quoteFeeRoute(url, env) {
  const email = url.searchParams.get('email') || '';
  return json({ quoteFee: quoteFeeFor(await getCompletedJobs(env, email)) });
}
