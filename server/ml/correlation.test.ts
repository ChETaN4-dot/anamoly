import { describe, expect, it } from "vitest";
import { calculatePearsonCorrelation } from "./correlation";

describe("Parameter Correlation Engine", () => {
  it("guards against insufficient paired sample size (N < 5)", () => {
    const sparsePairs = [
      { id: "C1", x: 1.0, y: 10.0 },
      { id: "C2", x: 1.5, y: 12.0 },
      { id: "C3", x: 2.0, y: 15.0 },
    ];

    const res = calculatePearsonCorrelation("DCL", "ESR", sparsePairs);
    expect(res.sufficient).toBe(false);
    expect(res.status).toBe("INSUFFICIENT_DATA");
    expect(res.r).toBeNull();
    expect(res.interpretation).toContain("minimum 5 required");
  });

  it("calculates strong positive correlation for correlated parameter pairs (N >= 5)", () => {
    const correlatedPairs = [
      { id: "C1", x: 1.0, y: 10.0 },
      { id: "C2", x: 2.0, y: 20.0 },
      { id: "C3", x: 3.0, y: 30.0 },
      { id: "C4", x: 4.0, y: 40.0 },
      { id: "C5", x: 5.0, y: 50.0 },
      { id: "C6", x: 6.0, y: 60.0 },
    ];

    const res = calculatePearsonCorrelation("DCL", "ESR", correlatedPairs);
    expect(res.sufficient).toBe(true);
    expect(res.status).toBe("VALID");
    expect(res.r).toBeCloseTo(1.0, 3);
    expect(res.strength).toBe("STRONG_POSITIVE");
  });

  it("calculates strong negative correlation for inversely correlated pairs", () => {
    const inversePairs = [
      { id: "C1", x: 10.0, y: 1.0 },
      { id: "C2", x: 8.0, y: 2.0 },
      { id: "C3", x: 6.0, y: 3.0 },
      { id: "C4", x: 4.0, y: 4.0 },
      { id: "C5", x: 2.0, y: 5.0 },
    ];

    const res = calculatePearsonCorrelation("RDS_ON", "VTH", inversePairs);
    expect(res.sufficient).toBe(true);
    expect(res.status).toBe("VALID");
    expect(res.r).toBeCloseTo(-1.0, 3);
    expect(res.strength).toBe("STRONG_NEGATIVE");
  });

  it("handles zero-variance parameter series gracefully without dividing by zero", () => {
    const zeroVariancePairs = [
      { id: "C1", x: 5.0, y: 12.0 },
      { id: "C2", x: 5.0, y: 14.0 },
      { id: "C3", x: 5.0, y: 11.0 },
      { id: "C4", x: 5.0, y: 15.0 },
      { id: "C5", x: 5.0, y: 13.0 },
    ];

    const res = calculatePearsonCorrelation("CAP", "DF", zeroVariancePairs);
    expect(res.sufficient).toBe(true);
    expect(res.status).toBe("ZERO_VARIANCE");
    expect(res.r).toBe(0);
  });
});
