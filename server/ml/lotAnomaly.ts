import { datasetStore, ComponentSummary } from "../data/datasetStore";
import { IsolationForest } from "./isolationForest";
import {
  ROBUST_Z_HIGH_RISK_THRESHOLD,
  ROBUST_Z_REVIEW_THRESHOLD,
  ISOLATION_FOREST_HIGH_RISK_THRESHOLD,
  ISOLATION_FOREST_REVIEW_THRESHOLD,
} from "./riskEngine";
import { getEngineeringCriterionForComponent, isValueExceedingSpec } from "../data/engineeringCriteria";

/**
 * Minimum lot size required for statistically stable Median/MAD and Isolation Forest scoring.
 * Below 10 components, statistical dispersion metrics (MAD) and random tree splits become unstable.
 */
export const MIN_LOT_SIZE_FOR_ANOMALY_DETECTION = 10;

export type ComponentAnomalyResult = {
  componentId: string;
  lotId: string;
  componentType: string;
  parameterName: string;
  unit: string;
  capacitance_uF?: number;
  rated_voltage_V?: number;
  test_voltage_V?: number;
  test_temperature_C?: number;
  dataSource: string;
  dataType: string;

  // Measurement stats
  availableCheckpoints: number[];
  currentValue: number;
  currentDcl?: number; // legacy alias
  latestTimeH: number;
  valChange: number;
  dclChange?: number; // legacy alias
  pctChange: number;
  earlySlope: number;
  lateSlope?: number;

  // Lot baseline comparison
  lotMedianVal: number;
  lotMedianDcl?: number; // legacy alias
  lotMadVal: number;
  lotMadDcl?: number; // legacy alias
  deviationFromLotMedian: number;
  robustZScore: number;
  isolationForestScore: number;

  // Engineering & Status
  specLimit: number;
  specLimitExceeded: boolean;
  status: "NORMAL" | "REVIEW" | "HIGH RISK";
  reasonForFlag: string;
  explanation: string;
  observedTrend: string;
};

export type LotAnomalyAnalysisResult = {
  lotId: string;
  parameterName: string;
  totalComponentsInLot: number;
  dataType: string;
  sufficient: boolean;
  message?: string;

  lotBaseline?: {
    medianVal: number;
    medianDcl?: number;
    madVal: number;
    madDcl?: number;
    medianEarlySlope: number;
    minVal: number;
    maxVal: number;
    timePoints: Array<{
      time_h: number;
      median: number;
      q25: number;
      q75: number;
      min: number;
      max: number;
    }>;
  };

  components: ComponentAnomalyResult[];
  flaggedCount: number;
  highRiskCount: number;
  reviewCount: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mad(values: number[], center: number): number {
  return median(values.map((v) => Math.abs(v - center)));
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function analyzeLotAnomalies(lotId: string, targetParam?: string): LotAnomalyAnalysisResult {
  const allComps = datasetStore.getComponentList();
  const lotComps = allComps.filter((c) => c.lot_id === lotId);

  if (lotComps.length === 0) {
    throw new Error(`Lot with ID ${lotId} not found`);
  }

  const dataType = lotComps[0].data_type;

  // Determine parameter to analyze (default to first available or targetParam or "DCL")
  let paramName = targetParam || "DCL";
  const availableParams = Array.from(new Set(lotComps.flatMap(c => c.measurements.map(m => m.parameter || "DCL"))));
  if (targetParam && !availableParams.includes(targetParam) && availableParams.length > 0) {
    paramName = availableParams[0];
  } else if (!targetParam && availableParams.length > 0 && !availableParams.includes("DCL")) {
    paramName = availableParams[0];
  }

  // Filter components that have measurements for this parameter
  const validComps = lotComps.filter(c => c.measurements.some(m => (m.parameter || "DCL") === paramName));

  // Minimum lot size check
  if (validComps.length < MIN_LOT_SIZE_FOR_ANOMALY_DETECTION) {
    return {
      lotId,
      parameterName: paramName,
      totalComponentsInLot: validComps.length,
      dataType,
      sufficient: false,
      message: `Lot-level anomaly detection requires at least ${MIN_LOT_SIZE_FOR_ANOMALY_DETECTION} comparable components (this lot has ${validComps.length} for ${paramName}).`,
      components: [],
      flaggedCount: 0,
      highRiskCount: 0,
      reviewCount: 0,
    };
  }

  // 1. Calculate time-point lot baseline stats for chart bounds
  const allTimePoints = Array.from(
    new Set(validComps.flatMap((c) => c.measurements.filter(m => (m.parameter || "DCL") === paramName).map(m => m.time_h))),
  ).sort((a, b) => a - b);

  const timePointsStats = allTimePoints.map((t) => {
    const vals = validComps
      .flatMap((c) => c.measurements)
      .filter((m) => (m.parameter || "DCL") === paramName && m.time_h === t)
      .map((m) => m.dcl_uA);

    const med = median(vals);
    const q25 = quantile(vals, 0.25);
    const q75 = quantile(vals, 0.75);
    const min = vals.length > 0 ? Math.min(...vals) : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 0;

    return { time_h: t, median: med, q25, q75, min, max };
  });

  // Extract Latest Values and Early Slopes for all lot components
  const latestVals = validComps.map((c) => {
    const paramMeas = c.measurements.filter(m => (m.parameter || "DCL") === paramName);
    return paramMeas[paramMeas.length - 1]?.dcl_uA ?? 0;
  });

  const lotMedianVal = median(latestVals);
  const lotMadVal = mad(latestVals, lotMedianVal);

  const earlySlopes = validComps.map((c) => {
    const paramMeas = c.measurements.filter(m => (m.parameter || "DCL") === paramName);
    if (paramMeas.length >= 2) {
      const dt = paramMeas[1].time_h - paramMeas[0].time_h;
      return dt > 0 ? (paramMeas[1].dcl_uA - paramMeas[0].dcl_uA) / dt : 0;
    }
    return 0;
  });
  const medianEarlySlope = median(earlySlopes);

  // 2. Prepare feature vectors for Isolation Forest
  const featureMatrix: number[][] = [];
  const compMetrics: Array<{
    comp: ComponentSummary;
    currentVal: number;
    latestTimeH: number;
    valChange: number;
    pctChange: number;
    earlySlope: number;
    lateSlope?: number;
    deviationFromLotMedian: number;
    robustZScore: number;
    specCriterion: ReturnType<typeof getEngineeringCriterionForComponent>;
    unit: string;
  }> = [];

  for (const c of validComps) {
    const paramMeas = c.measurements.filter(m => (m.parameter || "DCL") === paramName);
    const first = paramMeas[0] ?? { time_h: 0, dcl_uA: 0, unit: "unit" };
    const latest = paramMeas[paramMeas.length - 1] ?? first;

    const currentVal = latest.dcl_uA;
    const valChange = currentVal - first.dcl_uA;
    const pctChange = first.dcl_uA !== 0 ? (valChange / Math.abs(first.dcl_uA)) * 100 : 0;
    const earlySlope = paramMeas.length >= 2 && paramMeas[1].time_h > paramMeas[0].time_h
      ? (paramMeas[1].dcl_uA - paramMeas[0].dcl_uA) / (paramMeas[1].time_h - paramMeas[0].time_h)
      : 0;
    const lateSlope = paramMeas.length >= 4 && paramMeas[3].time_h > paramMeas[1].time_h
      ? (paramMeas[3].dcl_uA - paramMeas[1].dcl_uA) / (paramMeas[3].time_h - paramMeas[1].time_h)
      : undefined;

    const dev = currentVal - lotMedianVal;
    const zScore = lotMadVal > 0 ? dev / (1.4826 * lotMadVal) : dev === 0 ? 0 : Math.sign(dev) * 999.0;

    const specCriterion = getEngineeringCriterionForComponent(
      c.capacitance_uF,
      c.rated_voltage_V,
      c.component_type,
      paramName
    );

    compMetrics.push({
      comp: c,
      currentVal,
      latestTimeH: latest.time_h,
      valChange,
      pctChange,
      earlySlope,
      lateSlope,
      deviationFromLotMedian: dev,
      robustZScore: zScore,
      specCriterion,
      unit: latest.unit || specCriterion.unit,
    });

    featureMatrix.push([currentVal, valChange, pctChange, earlySlope, zScore]);
  }

  // 3. Train Isolation Forest on lot feature matrix
  const iforest = new IsolationForest(100, Math.min(256, validComps.length));
  iforest.fit(featureMatrix);
  const ifScores = iforest.predictScores(featureMatrix);

  // 4. Assign status, reason, and data-driven explanations
  const results: ComponentAnomalyResult[] = compMetrics.map((item, idx) => {
    const ifScore = ifScores[idx] ?? 0.5;
    const { comp, currentVal, latestTimeH, valChange, pctChange, earlySlope, lateSlope, deviationFromLotMedian, robustZScore, specCriterion, unit } = item;

    const specLimitExceeded = isValueExceedingSpec(currentVal, specCriterion);

    let status: "NORMAL" | "REVIEW" | "HIGH RISK" = "NORMAL";
    let reasonForFlag = `Behavior is consistent with lot baseline for ${paramName}`;

    if (specLimitExceeded) {
      status = "HIGH RISK";
      reasonForFlag = `Measured ${paramName} (${currentVal.toFixed(3)} ${unit}) directly violates qualified spec limit (${specCriterion.value} ${unit})`;
    } else if (robustZScore >= ROBUST_Z_HIGH_RISK_THRESHOLD || (ifScore >= ISOLATION_FOREST_HIGH_RISK_THRESHOLD && robustZScore >= ROBUST_Z_REVIEW_THRESHOLD)) {
      status = "HIGH RISK";
      reasonForFlag = `Severe lot outlier behavior in ${paramName} detected (Z = ${robustZScore.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}) requiring engineering review`;
    } else if (robustZScore >= ROBUST_Z_REVIEW_THRESHOLD || ifScore >= ISOLATION_FOREST_REVIEW_THRESHOLD) {
      status = "REVIEW";
      reasonForFlag = `Mild lot-relative deviation in ${paramName} (Z = ${robustZScore.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}) requires engineering review`;
    }

    // Generate specific data-driven explanation
    const pctDiffMedian = lotMedianVal !== 0 ? ((currentVal - lotMedianVal) / Math.abs(lotMedianVal)) * 100 : 0;
    const trendText = valChange > 0
      ? `upward drift of +${valChange.toFixed(3)} ${unit} (+${pctChange.toFixed(1)}%)`
      : valChange < 0
      ? `downward drift of ${valChange.toFixed(3)} ${unit} (${pctChange.toFixed(1)}%)`
      : `stable trend (0.00 ${unit} change)`;

    let explanation = `Component ${comp.component_id} exhibits a ${paramName} of ${currentVal.toFixed(3)} ${unit} at ${latestTimeH}h (${pctDiffMedian >= 0 ? "+" : ""}${pctDiffMedian.toFixed(1)}% relative to lot median ${lotMedianVal.toFixed(3)} ${unit}). `;
    explanation += `Degradation slope is ${earlySlope.toFixed(4)} ${unit}/hour vs lot median slope of ${medianEarlySlope.toFixed(4)} ${unit}/hour. `;

    if (specLimitExceeded) {
      explanation += `CRITICAL: Measurement violates component specification limit of ${specCriterion.value} ${unit} (nonconformance).`;
    } else if (status === "HIGH RISK") {
      explanation += `Component shows severe statistical divergence (Robust Z-score = ${robustZScore.toFixed(2)} MAD, Isolation Forest score = ${ifScore.toFixed(2)}). ANOMALY ≠ PHYSICAL FAILURE: requires engineering review.`;
    } else if (status === "REVIEW") {
      explanation += `Component shows moderate deviation from lot envelope (Robust Z-score = ${robustZScore.toFixed(2)} MAD, Isolation Forest score = ${ifScore.toFixed(2)}). Recommended for engineering review.`;
    } else {
      explanation += `Within normal statistical boundaries of the lot (Robust Z-score = ${robustZScore.toFixed(2)} MAD, Isolation Forest score = ${ifScore.toFixed(2)}). Applicable spec limit is ${specCriterion.value} ${unit}.`;
    }

    return {
      componentId: comp.component_id,
      lotId: comp.lot_id,
      componentType: comp.component_type,
      parameterName: paramName,
      unit,
      capacitance_uF: comp.capacitance_uF,
      rated_voltage_V: comp.rated_voltage_V,
      test_voltage_V: comp.test_voltage_V,
      test_temperature_C: comp.test_temperature_C,
      dataSource: comp.data_source,
      dataType: comp.data_type,
      availableCheckpoints: comp.available_checkpoints,
      currentValue: currentVal,
      currentDcl: currentVal, // legacy alias
      latestTimeH,
      valChange,
      dclChange: valChange, // legacy alias
      pctChange,
      earlySlope,
      lateSlope,
      lotMedianVal,
      lotMedianDcl: lotMedianVal, // legacy alias
      lotMadVal,
      lotMadDcl: lotMadVal, // legacy alias
      deviationFromLotMedian,
      robustZScore,
      isolationForestScore: ifScore,
      specLimit: specCriterion.value,
      specLimitExceeded,
      status,
      reasonForFlag,
      explanation,
      observedTrend: trendText,
    };
  });

  // Sort components by risk status (HIGH RISK > REVIEW > NORMAL) then by Z-score
  const statusRank = { "HIGH RISK": 0, REVIEW: 1, NORMAL: 2 };
  results.sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.robustZScore - a.robustZScore);

  const highRiskCount = results.filter((r) => r.status === "HIGH RISK").length;
  const reviewCount = results.filter((r) => r.status === "REVIEW").length;
  const flaggedCount = highRiskCount + reviewCount;

  return {
    lotId,
    parameterName: paramName,
    totalComponentsInLot: validComps.length,
    dataType,
    sufficient: true,
    lotBaseline: {
      medianVal: lotMedianVal,
      medianDcl: lotMedianVal,
      madVal: lotMadVal,
      madDcl: lotMadVal,
      medianEarlySlope,
      minVal: Math.min(...latestVals),
      maxVal: Math.max(...latestVals),
      timePoints: timePointsStats,
    },
    components: results,
    flaggedCount,
    highRiskCount,
    reviewCount,
  };
}
