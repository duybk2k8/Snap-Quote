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

export interface Price {
  low: number;
  high: number;
  materials: [number, number];
  labour: [number, number];
  unit: string;
  quantity: number;
  multipliers: { region: number; condition: number; structural: number; learned: number };
  /** Data moat: correction learned from past signed contracts in this item type + region. */
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
  region: string | null;
}

export interface Contract {
  company: string;
  price: number;
  note: string;
  sentAt: string;
}

export interface Job {
  id: string;
  createdAt: string;
  customer: { name: string; email: string };
  region: string | null;
  detection: Detection;
  option: ReplacementOption;
  estimate: Estimate;
  before: string; // data URL
  after: string | null; // data URL
  payment: { amount: number; status: string };
  status: "awaiting_contract" | "contract_sent" | "accepted";
  contract: Contract | null;
  acceptedAt?: string;
}

export interface JobStats {
  total: number;
  contracts: number;
  fees: number;
  avgDeltaPct: number | null;
}

export interface Insights {
  totals: { plans: number; contracts: number; accepted: number; conversionPct: number };
  /** Estimate-to-contract calibration per item type + region. */
  calibration: { item_type: string; region: string; samples: number; factor: number; active: boolean }[];
  /** Visual-to-conversion: which visualized replacements become accepted jobs. */
  options: { option: string; item_type: string; plans: number; contracts: number; accepted: number; acceptRate: number }[];
  minSamples: number;
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
  config: () =>
    request<{ regions: string[]; storage: "kv" | "memory"; ai: boolean }>("/api/config"),

  /** Stage 1: Llama 3.2 Vision reads the photo. `image` = 512x512 JPEG data URL. */
  analyze: (image: string) =>
    request<{ detection: Detection }>("/api/analyze", { image }),

  /** Stage 2: Stable Diffusion inpainting (with mask) or img2img (without). */
  visualize: (image: string, prompt: string, mask?: string | null) =>
    request<{ image: string; mode: "inpaint" | "img2img" }>("/api/visualize", { image, prompt, mask: mask ?? null }),

  /** Stage 3: price book + Llama 3.3 feasibility summary. */
  estimate: (detection: Detection, option: ReplacementOption, region: string) =>
    request<{ estimate: Estimate }>("/api/estimate", { detection, option, region }),

  /** $49 verification (demo payment) – sends the plan to contractors. */
  submitJob: (payload: {
    name: string; email: string; region: string;
    detection: Detection; option: ReplacementOption; estimate: Estimate;
    before: string; after: string | null;
  }) => request<{ job: { id: string; status: Job["status"] } }>("/api/jobs", payload),

  getJob: (id: string) => request<{ job: Job }>(`/api/jobs/${id}`),

  listJobs: () => request<{ jobs: Job[]; stats: JobStats }>("/api/jobs"),

  sendContract: (id: string, company: string, price: number, note: string) =>
    request<{ job: Job }>(`/api/jobs/${id}/contract`, { company, price, note }),

  /** Homeowner accepts the contract (feeds visual-to-conversion data). */
  acceptContract: (id: string) => request<{ job: Job }>(`/api/jobs/${id}/accept`, {}),

  /** Anonymous learning data: calibration + conversion by visualized option. */
  insights: () => request<Insights>("/api/insights"),
};
