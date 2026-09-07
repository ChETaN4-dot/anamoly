/**
 * Parameter Correlation Engine
 * Computes Pearson correlation coefficient (r) on paired parameter observations.
 * Strict scientific guard: Requires at least N >= 5 paired observations.
 * Clearly framed as supporting evidence, NOT an independent safety verdict.
 */

export type PairedObservation = {
  id: string; // componentId or checkpointId
  x: number;
  y: number;
};

export type CorrelationResult = {
  param1: string;
  param2: string;
  n: number;
  r: number | null;
  rSquared: number | null;
  sufficient: boolean;
  status: "VALID" | "INSUFFICIENT_DATA" | "ZERO_VARIANCE";
  strength: "STRONG_POSITIVE" | "MODERATE_POSITIVE" | "WEAK_OR_NONE" | "MODERATE_NEGATIVE" | "STRONG_NEGATIVE" | "UNAVAILABLE";
  interpretation: string;
  pairs: PairedObservation[];
  notice: string;
};

export function calculatePearsonCorrelation(
  param1: string,
  param2: string,
  pairs: PairedObservation[]
): CorrelationResult {
  const notice = "Supporting statistical evidence only — does NOT constitute an independent pass/fail verdict.";
  const validPairs = pairs.filter(p => !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y));

  if (validPairs.length < 5) {
    return {
      param1,
      param2,
      n: validPairs.length,
      r: null,
      rSquared: null,
      sufficient: false,
      status: "INSUFFICIENT_DATA",
      strength: "UNAVAILABLE",
      interpretation: `Insufficient paired data for correlation (N = ${validPairs.length}, minimum 5 required for statistical validity).`,
      pairs: validPairs,
      notice,
    };
  }

  const n = validPairs.length;
  const meanX = validPairs.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = validPairs.reduce((sum, p) => sum + p.y, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (const p of validPairs) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) {
    return {
      param1,
      param2,
      n,
      r: 0,
      rSquared: 0,
      sufficient: true,
      status: "ZERO_VARIANCE",
      strength: "WEAK_OR_NONE",
      interpretation: "Zero variance detected in one or both parameter series (constant values observed across sample).",
      pairs: validPairs,
      notice,
    };
  }

  const r = num / (Math.sqrt(denX) * Math.sqrt(denY));
  const rClamped = Math.max(-1.0, Math.min(1.0, r));
  const rSquared = rClamped * rClamped;

  let strength: CorrelationResult["strength"] = "WEAK_OR_NONE";
  let interpretation = "";

  if (rClamped >= 0.70) {
    strength = "STRONG_POSITIVE";
    interpretation = `Strong positive correlation (r = ${rClamped.toFixed(3)}, R² = ${rSquared.toFixed(3)}). Concomitant rise in ${param1} and ${param2} indicates coupled degradation mechanism.`;
  } else if (rClamped >= 0.40) {
    strength = "MODERATE_POSITIVE";
    interpretation = `Moderate positive correlation (r = ${rClamped.toFixed(3)}, R² = ${rSquared.toFixed(3)}). Positive alignment between ${param1} and ${param2}.`;
  } else if (rClamped <= -0.70) {
    strength = "STRONG_NEGATIVE";
    interpretation = `Strong negative correlation (r = ${rClamped.toFixed(3)}, R² = ${rSquared.toFixed(3)}). Inverse relationship observed between ${param1} and ${param2}.`;
  } else if (rClamped <= -0.40) {
    strength = "MODERATE_NEGATIVE";
    interpretation = `Moderate negative correlation (r = ${rClamped.toFixed(3)}, R² = ${rSquared.toFixed(3)}). Mild inverse trend between ${param1} and ${param2}.`;
  } else {
    strength = "WEAK_OR_NONE";
    interpretation = `Weak or negligible correlation (r = ${rClamped.toFixed(3)}, R² = ${rSquared.toFixed(3)}). ${param1} and ${param2} vary independently in this cohort.`;
  }

  return {
    param1,
    param2,
    n,
    r: Number(rClamped.toFixed(4)),
    rSquared: Number(rSquared.toFixed(4)),
    sufficient: true,
    status: "VALID",
    strength,
    interpretation,
    pairs: validPairs,
    notice,
  };
}
