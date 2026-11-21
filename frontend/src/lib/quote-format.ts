import type { Price } from "./snapquote-api";

export type Tone = "success" | "warning" | "danger";

/** Feasibility score color: >= 8 green, >= 5 amber, otherwise red. */
export function scoreTone(score: number): Tone {
  if (score >= 8) return "success";
  if (score >= 5) return "warning";
  return "danger";
}

/** Condition badge color: good = green, fair = amber, poor = red. */
export function conditionTone(condition: "good" | "fair" | "poor"): Tone {
  if (condition === "good") return "success";
  if (condition === "fair") return "warning";
  return "danger";
}

export function usd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Text for the "Local accuracy" badge. */
export function calibrationText(c: Price["calibration"]): string {
  if (c.applied) {
    return `Adjusted from ${c.samples} signed contracts in your area (×${c.factor})`;
  }
  return `Learning: ${c.samples}/${c.needed} local contracts`;
}

export function multipliersText(m: Price["multipliers"]): string {
  return `Region ×${m.region} · Condition ×${m.condition} · Structural ×${m.structural} · Local ×${m.learned}`;
}
