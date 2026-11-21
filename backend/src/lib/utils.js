// Shared helpers: JSON responses with CORS, parsing, number and base64 utilities.

let ENV = {}; // set per request so json() can read ALLOWED_ORIGIN
export function setEnv(env) {
  ENV = env || {};
}

export function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(ENV) },
  });
}

export function readJSON(res) {
  if (!res) return null;
  const r = res.response !== undefined ? res.response : res;
  if (r && typeof r === 'object') return r;
  const text = String(r || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function arr(v) {
  return Array.isArray(v) ? v.slice(0, 8).map(String) : [];
}

export function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function clampNum(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function round50(n) {
  return Math.round(n / 50) * 50;
}

export function b64ToBytes(dataUrl) {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
