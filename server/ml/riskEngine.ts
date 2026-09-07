/**
 * Centralized Threshold Constants for Anomaly and Risk Classification.
 * Each constant represents a statistically or scientifically calibrated boundary.
 */

// Robust Z-score thresholds (MAD-equivalent units from median)
// Z >= 3.5 corresponds to severe outlier status in non-Gaussian distribution
export const ROBUST_Z_HIGH_RISK_THRESHOLD = 3.5;
// Z >= 2.5 represents initial deviation from lot baseline envelope
export const ROBUST_Z_REVIEW_THRESHOLD = 2.5;

// Isolation Forest anomaly score thresholds (s in [0, 1])
// s >= 0.60 indicates strong multi-dimensional isolation in decision tree space
export const ISOLATION_FOREST_HIGH_RISK_THRESHOLD = 0.60;
// s >= 0.55 indicates moderate anomaly tendency
export const ISOLATION_FOREST_REVIEW_THRESHOLD = 0.55;

// Maximum degradation slope threshold (unit/hour) — Dynamically scaled based on component spec limit
export function getDynamicSafetySlopeThreshold(specLimit?: number, customSlopeThreshold?: number): number {
  if (customSlopeThreshold !== undefined && customSlopeThreshold > 0) {
    return customSlopeThreshold;
  }
  if (specLimit && specLimit > 0) {
    // Dynamically scale slope threshold to 1/1000th of specification ceiling per hour (minimum 0.005 unit/h)
    return Math.max(0.005, Number((specLimit / 1000).toFixed(4)));
  }
  return 0.05;
}

// System Versioning Identifiers
export const VERSION_METADATA = {
  model_version: "isolation-forest-v1 / ridge-loco-v1",
  dataset_version: "burnin-sentinel-v2-sqlite-1000plus",
  feature_version: "multi-param-features-v2",
  logic_version: "unified-risk-engine-v3-multi-param",
};

export type UnifiedRiskInput = {
  measuredValue: number;
  measuredDcl?: number; // legacy alias
  specLimit: number;
  minValue?: number;
  maxValue?: number;
  isTwoSided?: boolean;
  parameterName?: string;
  unit?: string;
  customSafetySlopeThreshold?: number;
  // Module A Evidence (optional)
  robustZScore?: number;
  isolationForestScore?: number;
  // Module B Evidence (optional)
  earlySlope?: number;
  predicted168h?: number;
  predicted168hDcl?: number; // legacy alias
  forecastSupported?: boolean;
};

export type UnifiedRiskVerdict = {
  parameterName: string;
  status: "NORMAL" | "REVIEW" | "HIGH RISK";
  specLimitExceeded: boolean;
  predictedLimitExceeded: boolean;
  safetySlopeExceeded: boolean;
  lotOutlierFlagged: boolean;
  reasonCode: string;
  verdictSummary: string;
  versionMetadata: typeof VERSION_METADATA;
  timestamp: string;
};

/**
 * Transparent Deterministic Rule Engine for Single Parameter
 * Combines Module A anomaly evidence, Module B drift/prediction evidence, and Spec Limits.
 */
export function evaluateUnifiedRisk(input: UnifiedRiskInput): UnifiedRiskVerdict {
  const measuredVal = input.measuredValue ?? input.measuredDcl ?? 0;
  const predVal = input.predicted168h ?? input.predicted168hDcl;
  const paramName = input.parameterName || "DCL";
  const unit = input.unit || "µA";
  const { specLimit, minValue, maxValue, isTwoSided, robustZScore, isolationForestScore, earlySlope, customSafetySlopeThreshold, forecastSupported = true } = input;

  const effectiveSafetySlopeThreshold = getDynamicSafetySlopeThreshold(specLimit, customSafetySlopeThreshold);

  // Spec check
  let specLimitExceeded = false;
  if (isTwoSided && minValue !== undefined && maxValue !== undefined) {
    specLimitExceeded = measuredVal < minValue || measuredVal > maxValue;
  } else if (maxValue !== undefined) {
    specLimitExceeded = measuredVal > maxValue;
  } else {
    specLimitExceeded = measuredVal > specLimit;
  }

  // Predicted spec check
  let predictedLimitExceeded = false;
  if (forecastSupported && predVal !== undefined) {
    if (isTwoSided && minValue !== undefined && maxValue !== undefined) {
      predictedLimitExceeded = predVal < minValue || predVal > maxValue;
    } else if (maxValue !== undefined) {
      predictedLimitExceeded = predVal > maxValue;
    } else {
      predictedLimitExceeded = predVal > specLimit;
    }
  }

  const safetySlopeExceeded = Boolean(forecastSupported && earlySlope && earlySlope > effectiveSafetySlopeThreshold);

  const z = robustZScore ?? 0;
  const ifScore = isolationForestScore ?? 0;

  const isHighRiskOutlier = z >= ROBUST_Z_HIGH_RISK_THRESHOLD || (ifScore >= ISOLATION_FOREST_HIGH_RISK_THRESHOLD && z >= ROBUST_Z_REVIEW_THRESHOLD);
  const isReviewOutlier = z >= ROBUST_Z_REVIEW_THRESHOLD || ifScore >= ISOLATION_FOREST_REVIEW_THRESHOLD;
  const lotOutlierFlagged = isHighRiskOutlier || isReviewOutlier;

  let status: "NORMAL" | "REVIEW" | "HIGH RISK" = "NORMAL";
  let reasonCode = "WITHIN_NORMAL_ENVELOPE";
  let verdictSummary = `Component operates within normal statistical lot baseline and specification limits for ${paramName}.`;

  if (specLimitExceeded) {
    status = "HIGH RISK";
    reasonCode = "SPEC_LIMIT_EXCEEDED";
    verdictSummary = `Measured ${paramName} (${measuredVal.toFixed(3)} ${unit}) exceeds engineering spec limit (${specLimit} ${unit}). Direct nonconformance.`;
  } else if (predictedLimitExceeded) {
    status = "HIGH RISK";
    reasonCode = "PREDICTED_SPEC_VIOLATION";
    verdictSummary = `Predicted 168h ${paramName} (${predVal?.toFixed(3)} ${unit}) is forecast to cross engineering spec limit (${specLimit} ${unit}).`;
  } else if (isHighRiskOutlier) {
    status = "HIGH RISK";
    reasonCode = "SEVERE_LOT_ANOMALY";
    verdictSummary = `Abnormal lot behavior detected in ${paramName} (Z = ${z.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}). ANOMALY ≠ PHYSICAL FAILURE: requires engineering review.`;
  } else if (safetySlopeExceeded) {
    status = "REVIEW";
    reasonCode = "SAFETY_SLOPE_EXCEEDED";
    verdictSummary = `Degradation slope in ${paramName} (${earlySlope?.toFixed(4)} ${unit}/h) exceeds dynamic safety threshold (${effectiveSafetySlopeThreshold.toFixed(4)} ${unit}/h). Requires review.`;
  } else if (isReviewOutlier) {
    status = "REVIEW";
    reasonCode = "MODERATE_LOT_DEVIATION";
    verdictSummary = `Moderate lot-relative deviation in ${paramName} (Z = ${z.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}). Recommended for engineering review.`;
  }

  return {
    parameterName: paramName,
    status,
    specLimitExceeded,
    predictedLimitExceeded,
    safetySlopeExceeded,
    lotOutlierFlagged,
    reasonCode,
    verdictSummary,
    versionMetadata: VERSION_METADATA,
    timestamp: new Date().toISOString(),
  };
}

export type MultiParameterCompoundVerdict = {
  overallStatus: "NORMAL" | "REVIEW" | "HIGH RISK";
  flaggedParametersCount: number;
  totalParametersEvaluated: number;
  compoundReasonSummary: string;
  parameterResults: Record<string, UnifiedRiskVerdict>;
  versionMetadata: typeof VERSION_METADATA;
  timestamp: string;
};

/**
 * Compound Risk Evaluation across multiple parameters
 * Aggregates evidence without letting one parameter override another incorrectly.
 */
export function evaluateMultiParameterRisk(results: UnifiedRiskVerdict[]): MultiParameterCompoundVerdict {
  const paramMap: Record<string, UnifiedRiskVerdict> = {};
  let overallStatus: "NORMAL" | "REVIEW" | "HIGH RISK" = "NORMAL";
  const highRiskParams: string[] = [];
  const reviewParams: string[] = [];

  for (const res of results) {
    paramMap[res.parameterName] = res;
    if (res.status === "HIGH RISK") {
      highRiskParams.push(res.parameterName);
    } else if (res.status === "REVIEW") {
      reviewParams.push(res.parameterName);
    }
  }

  if (highRiskParams.length > 0) {
    overallStatus = "HIGH RISK";
  } else if (reviewParams.length > 0) {
    overallStatus = "REVIEW";
  }

  let compoundReasonSummary = "All evaluated parameters operate within normal statistical baseline envelopes and specification boundaries.";
  if (highRiskParams.length > 0 && reviewParams.length > 0) {
    compoundReasonSummary = `Compound multi-parameter risk detected: HIGH RISK in [${highRiskParams.join(", ")}] and REVIEW in [${reviewParams.join(", ")}]. Engineering disposition required.`;
  } else if (highRiskParams.length > 0) {
    compoundReasonSummary = `High risk detected in parameters [${highRiskParams.join(", ")}]. Investigation required before qualification.`;
  } else if (reviewParams.length > 0) {
    compoundReasonSummary = `Elevated drift/dispersion detected in parameters [${reviewParams.join(", ")}]. Engineering review recommended.`;
  }

  return {
    overallStatus,
    flaggedParametersCount: highRiskParams.length + reviewParams.length,
    totalParametersEvaluated: results.length,
    compoundReasonSummary,
    parameterResults: paramMap,
    versionMetadata: VERSION_METADATA,
    timestamp: new Date().toISOString(),
  };
}
