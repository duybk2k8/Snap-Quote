// SnapQuote API client for the Lovable front end.
// Set VITE_API_BASE_URL to your Worker URL, e.g. https://odd-lab-d694.<your-subdomain>.workers.dev

export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "https://odd-lab-d694.YOUR-SUBDOMAIN.workers.dev";

export type ItemType =
  | "window" | "door" | "roof" | "cabinet" | "hvac"
  | "siding" | "flooring" | "fence" | "other";

export interface ReplacementOption {
  name: string;
  prompt: string;
  /** Set when paid jobs in this area chose this option (count of paid jobs). */
  localFavorite?: number;
}

export interface Detection {
  item_type: ItemType;
  item_label: string;
  material: string;
  condition: "good" | "fair" | "poor";
  visible_issues: string[];
  quantity: number;
  approx_dimensions: string;
  structural_concern: boolean;
  replacement_options: ReplacementOption[];
}

/** What paid jobs in this area tell us (learning data). */
export interface LocalContext {
  completedJobs: number;
  popularOptions: { name: string; count: number }[];
  avgPaidPrice: number | null;
}

export interface Price {
  low: number;
  high: number;
  materials: [number, number];
  labour: [number, number];
  unit: string;
  quantity: number;
  multipliers: { region: number; condition: number; structural: number; learned: number };
  /** Correction learned from paid jobs in this item type + region. */
  calibration: { applied: boolean; samples: number; factor: number; needed: number };
}

export interface Estimate {
  feasibility_score: number;
  feasibility_label: string;
  rationale: string;
  scope: string[];
  materials: string[];
  timeline_days: number;
  verify_on_site: string[];
  price: Price;
  local: LocalContext;
  region: string | null;
}

export interface QuoteFee {
  fee: number;          // what the homeowner pays now
  base: number;         // $25
  discountPct: number;  // loyalty discount applied
  completedJobs: number;
  nextFee: number;      // fee after one more completed repair
  floor: number;
}

export interface Company {
  slug: string;
  name: string;
  city: string;
  trades: string[];
  plan: { monthlyFee: number; status: string };
  createdAt: string;
}

export interface Contract {
  company: string;
  repairPrice: number;
  quoteFee: number;
  discountPct: number;
  total: number;
  note: string;
  sentAt: string;
}

export interface Billing {
  repairPrice: number;
  quoteFee: number;
  total: number;
  platformCommission: number;
  companyPayout: number;
  commissionPct: number;
  method: string;
  paidAt: string;
}

export type JobStatus = "requested" | "contract_sent" | "paid";

export interface Job {
  id: string;
  createdAt: string;
  company: { slug: string; name: string } | null;
  customer: { name: string; email: string };
  region: string | null;
  detection: Detection;
  option: ReplacementOption;
  estimate: Estimate;
  before: string; // data URL
  after: string | null; // data URL
  quoteFeePreview: QuoteFee;
  status: JobStatus;
  contract: Contract | null;
  billing: Billing | null;
  nextQuoteFee?: QuoteFee;
}

export interface JobStats {
  requests: number;
  contracts: number;
  paid: number;
  repairRevenue: number;
  quoteFees: number;
  platformCommission: number;
  companyPayout: number;
  avgDeltaPct: number | null;
}

export interface Insights {
  totals: { requests: number; contracts: number; paid: number; conversionPct: number; learningRecords: number };
  calibration: { item_type: string; region: string; samples: number; factor: number; active: boolean }[];
  /** What homeowners actually bought, from paid jobs only. */
  options: { option: string; item_type: string; completed: number; avgPaidPrice: number }[];
  minSamples: number;
}

export interface Config {
  regions: string[];
  storage: "kv" | "memory";
  ai: boolean;
  pricing: {
    quoteFee: number;
    loyaltyDiscountPct: number;
    quoteFeeFloor: number;
    platformCommissionPct: number;
    companyPlanFee: number;
  };
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE_URL + path, body === undefined
    ? undefined
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as any).error) {
    throw new Error((data as any).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  config: () => request<Config>("/api/config"),

  // ---- Free quoting ----
  /** Stage 1: vision analysis. `image` = 512x512 JPEG data URL. Pass region to get local favorites. */
  analyze: (image: string, region?: string) =>
    request<{ detection: Detection; local: LocalContext | null }>("/api/analyze", { image, region }),

  /** Stage 2: Stable Diffusion inpainting (with mask) or img2img (without). */
  visualize: (image: string, prompt: string, mask?: string | null) =>
    request<{ image: string; mode: "inpaint" | "img2img" }>("/api/visualize", { image, prompt, mask: mask ?? null }),

  /** Stage 3: price book (+ learned correction) and feasibility summary. */
  estimate: (detection: Detection, option: ReplacementOption, region: string) =>
    request<{ estimate: Estimate }>("/api/estimate", { detection, option, region }),

  /** Quote fee this homeowner would pay right now (loyalty discount applied). */
  quoteFee: (email: string) =>
    request<{ quoteFee: QuoteFee }>(`/api/quote-fee?email=${encodeURIComponent(email)}`),

  // ---- Companies ----
  createCompany: (name: string, city = "", email = "", trades: string[] = []) =>
    request<{ company: Company }>("/api/companies", { name, city, email, trades }),
  listCompanies: () => request<{ companies: Company[] }>("/api/companies"),
  getCompany: (slug: string) => request<{ company: Company }>(`/api/companies/${slug}`),

  // ---- Requests, contracts, payment ----
  /** Free request to a company. No payment at this step. */
  sendRequest: (payload: {
    company?: string; name: string; email: string; region: string;
    detection: Detection; option: ReplacementOption; estimate: Estimate;
    before: string; after: string | null;
  }) => request<{ job: { id: string; status: JobStatus; quoteFee: QuoteFee } }>("/api/jobs", payload),

  getJob: (id: string) => request<{ job: Job }>(`/api/jobs/${id}`),

  /** Company dashboard. Pass a company slug to see only that company's jobs. */
  listJobs: (company?: string) =>
    request<{ jobs: Job[]; stats: JobStats }>(company ? `/api/jobs?company=${company}` : "/api/jobs"),

  /** Company finalizes the contract with the repair price; quote fee is added automatically. */
  finalizeContract: (id: string, repairPrice: number, note = "") =>
    request<{ job: Job }>(`/api/jobs/${id}/contract`, { repairPrice, note }),

  /** Homeowner accepts and pays repair price + quote fee (demo payment). */
  payContract: (id: string) => request<{ job: Job }>(`/api/jobs/${id}/pay`, {}),

  // ---- Learning data ----
  insights: () => request<Insights>("/api/insights"),
};
