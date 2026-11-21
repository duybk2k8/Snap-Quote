// Companies: service businesses that send their customers to SnapQuote instead of
// sending an inspector. Each company gets a public link: /c/<slug>.

import { COMPANY_PLAN_FEE } from '../config.js';
import { json } from '../lib/utils.js';
import { getData, putData, listData } from '../lib/storage.js';

function slugify(name) {
  return String(name || 'company')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';
}

export async function getCompany(env, slug) {
  if (!slug) return null;
  return await getData(env, 'company:' + slug);
}

export async function createCompany(request, env) {
  const b = await request.json();
  if (!b.name || !String(b.name).trim()) return json({ error: 'Company name is required' }, 400);
  let slug = slugify(b.name);
  if (await getCompany(env, slug)) slug = slug + '-' + crypto.randomUUID().slice(0, 4);
  const company = {
    slug,
    name: String(b.name).trim().slice(0, 80),
    city: String(b.city || '').slice(0, 60),
    trades: Array.isArray(b.trades) ? b.trades.slice(0, 8).map(String) : [],
    email: String(b.email || '').slice(0, 80),
    plan: { monthlyFee: COMPANY_PLAN_FEE, status: 'active (demo)' },
    createdAt: new Date().toISOString(),
  };
  await putData(env, 'company:' + slug, company);
  return json({ company });
}

export async function listCompaniesRoute(env) {
  const companies = (await listData(env, 'company:')).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  // Email stays private on the public list.
  return json({ companies: companies.map(({ email, ...c }) => c) });
}

export async function getCompanyRoute(env, slug) {
  const c = await getCompany(env, slug);
  if (!c) return json({ error: 'Company not found' }, 404);
  const { email, ...pub } = c;
  return json({ company: pub });
}
