import { describe, expect, it } from "vitest";
import { calibrationText, conditionTone, scoreTone } from "@/lib/quote-format";

describe("feasibility score color", () => {
  it("is green at 8 and above", () => {
    expect(scoreTone(8)).toBe("success");
    expect(scoreTone(10)).toBe("success");
  });
  it("is amber from 5 to 7", () => {
    expect(scoreTone(5)).toBe("warning");
    expect(scoreTone(7)).toBe("warning");
  });
  it("is red below 5", () => {
    expect(scoreTone(4)).toBe("danger");
  });
});

describe("condition badge color", () => {
  it("maps good/fair/poor to green/amber/red", () => {
    expect(conditionTone("good")).toBe("success");
    expect(conditionTone("fair")).toBe("warning");
    expect(conditionTone("poor")).toBe("danger");
  });
});

describe("local accuracy badge", () => {
  it("shows the adjustment when calibration is applied", () => {
    expect(calibrationText({ applied: true, samples: 7, factor: 1.12, needed: 5 })).toBe(
      "Adjusted from 7 signed contracts in your area (×1.12)",
    );
  });
  it("shows learning progress otherwise", () => {
    expect(calibrationText({ applied: false, samples: 2, factor: 1, needed: 5 })).toBe(
      "Learning: 2/5 local contracts",
    );
  });
});
