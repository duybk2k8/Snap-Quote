// api.js — every call to the SnapQuote backend (Cloudflare Worker) lives here.
// Pages call these functions instead of using fetch() directly.

// Where the backend runs. Change this one line if the Worker URL changes.
const API_BASE = "https://odd-lab-d694.duybuikhanh208.workers.dev";

// Sends a request and returns the JSON answer, or throws an Error with the backend's message.
async function request(path, body) {
  const options = body === undefined
    ? {} // GET
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };

  const res = await fetch(API_BASE + path, options);
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // The server answered with something that is not JSON (for example a Cloudflare error page).
    throw new Error("The server had a problem (" + res.status + "). Please try again.");
  }
  if (!res.ok || data.error) throw new Error(data.error || "Request failed (" + res.status + ")");
  return data;
}

// One object with a function per backend endpoint. Use it like: const cfg = await api.config();
const api = {
  config: () => request("/api/config"),

  // Free quoting (AI)
  analyze: (image, region) => request("/api/analyze", { image, region }),
  visualize: (image, prompt, mask) => request("/api/visualize", { image, prompt, mask: mask || null }),
  estimate: (detection, option, region) => request("/api/estimate", { detection, option, region }),
  quoteFee: (email) => request("/api/quote-fee?email=" + encodeURIComponent(email)),

  // Companies
  createCompany: (company) => request("/api/companies", company),
  listCompanies: () => request("/api/companies"),
  getCompany: (slug) => request("/api/companies/" + encodeURIComponent(slug)),

  // Requests → contract → payment
  sendRequest: (payload) => request("/api/jobs", payload),
  getJob: (id) => request("/api/jobs/" + encodeURIComponent(id)),
  listJobs: (company) => request(company ? "/api/jobs?company=" + encodeURIComponent(company) : "/api/jobs"),
  finalizeContract: (id, repairPrice, note) => request("/api/jobs/" + id + "/contract", { repairPrice, note }),
  payContract: (id) => request("/api/jobs/" + id + "/pay", {}),

  // Learning data
  insights: () => request("/api/insights"),
};
