// Storage: Workers KV (binding JOBS) with an in-memory fallback.
// Keys: job:<id> (full job), data:<id> (anonymous record), calib:<type>|<region> (learned correction).

const MEM = new Map(); // jobs, when no KV binding
const DATA_MEM = new Map(); // anonymous data, when no KV binding

export async function saveJob(env, job) {
  if (env.JOBS) await env.JOBS.put('job:' + job.id, JSON.stringify(job));
  else MEM.set(job.id, job);
}

export async function getJob(env, id) {
  if (env.JOBS) return await env.JOBS.get('job:' + id, 'json');
  return MEM.get(id) || null;
}

export async function getData(env, key) {
  if (env.JOBS) return await env.JOBS.get(key, 'json');
  return DATA_MEM.get(key) || null;
}

export async function putData(env, key, value) {
  if (env.JOBS) await env.JOBS.put(key, JSON.stringify(value));
  else DATA_MEM.set(key, value);
}

export async function listData(env, prefix, withKeys) {
  let pairs;
  if (env.JOBS) {
    const list = await env.JOBS.list({ prefix });
    pairs = await Promise.all(list.keys.map(async (k) => ({ key: k.name, value: await env.JOBS.get(k.name, 'json') })));
  } else {
    pairs = Array.from(DATA_MEM.entries())
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, value]) => ({ key, value }));
  }
  pairs = pairs.filter((p) => p.value);
  return withKeys ? pairs : pairs.map((p) => p.value);
}

export async function listJobs(env) {
  let jobs;
  if (env.JOBS) {
    const list = await env.JOBS.list({ prefix: 'job:' });
    jobs = (await Promise.all(list.keys.map((k) => env.JOBS.get(k.name, 'json')))).filter(Boolean);
  } else {
    jobs = Array.from(MEM.values());
  }
  return jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
