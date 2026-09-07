import { UnifiedRiskVerdict, MultiParameterCompoundVerdict, getDynamicSafetySlopeThreshold } from "./riskEngine";
import { EngineeringCriterion } from "../data/engineeringCriteria";

export type UnifiedExplanationInput = {
  componentId: string;
  lotId: string;
  currentValue?: number;
  currentDcl?: number; // legacy alias
  latestTimeH: number;
  valChange?: number;
  dclChange?: number; // legacy alias
  pctChange: number;
  earlySlope: number;
  lotMedianVal?: number;
  lotMedianDcl?: number; // legacy alias
  lotMadVal?: number;
  lotMadDcl?: number; // legacy alias
  robustZScore?: number;
  isolationForestScore?: number;
  predicted168hLinear?: number;
  predicted168hRidge?: number;
  ridgeMae?: number;
  specCriterion: EngineeringCriterion;
  verdict: UnifiedRiskVerdict;
  forecastSupported?: boolean;
};

export type ActionItem = {
  id: string;
  label: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  mandatory: boolean;
};

export type SynthesizedExplanation = {
  whatHappened: string;
  whyItOccurred: string;
  whatIsPredicted: string;
  whatEngineerShouldReview: string;
  fullSynthesisText: string;

  // Rich visual telemetry metadata
  riskScorePct: number;
  riskBadgeLabel: string;
  riskColorHex: string;
  mechanismCategory: string;
  actionItems: ActionItem[];
  specMarginPct: number;
  zScoreSeverity: "LOW" | "ELEVATED" | "SEVERE" | "CRITICAL";
};

export function generateUnifiedExplanation(input: UnifiedExplanationInput): SynthesizedExplanation {
  const {
    componentId,
    lotId,
    latestTimeH,
    pctChange,
    earlySlope,
    robustZScore,
    isolationForestScore,
    predicted168hLinear,
    predicted168hRidge,
    specCriterion,
    verdict,
    forecastSupported = true,
  } = input;

  const currentVal = input.currentValue ?? input.currentDcl ?? 0;
  const valChange = input.valChange ?? input.dclChange ?? 0;
  const lotMedVal = input.lotMedianVal ?? input.lotMedianDcl;
  const lotMadVal = input.lotMadVal ?? input.lotMadDcl;
  const paramName = specCriterion.parameter || verdict.parameterName || "DCL";
  const unit = specCriterion.unit || "unit";

  const status = verdict.status;

  // Determine Spec Margin
  const specValue = specCriterion.value;
  const specMarginPct = specValue !== 0 ? Math.max(0, ((specValue - currentVal) / specValue) * 100) : 100;

  // Determine Z-Score Severity
  let zScoreSeverity: "LOW" | "ELEVATED" | "SEVERE" | "CRITICAL" = "LOW";
  const zVal = robustZScore ?? 0;
  if (zVal >= 8.0) zScoreSeverity = "CRITICAL";
  else if (zVal >= 5.0) zScoreSeverity = "SEVERE";
  else if (zVal >= 2.5) zScoreSeverity = "ELEVATED";

  // Determine Risk Score & Theme Color
  let riskScorePct = 15;
  let riskBadgeLabel = "NOMINAL RELEASE";
  let riskColorHex = "#d6f24a"; // Chartreuse
  let mechanismCategory = `STABLE ${paramName.toUpperCase()} OPERATING STATE`;

  if (status === "HIGH RISK") {
    riskScorePct = Math.min(98, Math.max(75, Math.round(zVal * 8 + (verdict.specLimitExceeded ? 30 : 15))));
    riskBadgeLabel = verdict.specLimitExceeded ? "CRITICAL SPEC VIOLATION" : "HIGH RISK ANOMALY";
    riskColorHex = "#e57463"; // Crimson
    mechanismCategory = paramName === "DCL"
      ? "ACCELERATED OXYGEN-VACANCY MIGRATION & LOCAL THICKNESS VARIATION"
      : paramName === "RDS_ON"
      ? "CHANNEL MOBILITY DEGRADATION & GATE DIELECTRIC CHARGE TRAPPING"
      : `${paramName.toUpperCase()} ANOMALOUS PARAMETRIC DIVERGENCE`;
  } else if (status === "REVIEW") {
    riskScorePct = Math.min(74, Math.max(42, Math.round(zVal * 7 + earlySlope * 100)));
    riskBadgeLabel = "MODERATE DRIFT REVIEW";
    riskColorHex = "#f3b145"; // Amber
    mechanismCategory = paramName === "DCL"
      ? "THERMALLY ACTIVATED VACANCY MOBILITY & DRIFT ELEVATION"
      : `${paramName.toUpperCase()} ELEVATED DISPERSION & DRIFT`;
  }

  // 1. DYNAMIC "WHAT HAPPENED"
  let whatHappened = "";
  if (status === "HIGH RISK") {
    whatHappened = `CRITICAL DIVERGENCE DETECTED: Component ${componentId} (Lot ${lotId}) recorded a ${paramName} reading of ${currentVal.toFixed(3)} ${unit} at ${latestTimeH}h checkpoint (${valChange >= 0 ? "+" : ""}${valChange.toFixed(3)} ${unit}, ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% trajectory change). `;
    if (lotMedVal !== undefined && robustZScore !== undefined) {
      const pctDiff = lotMedVal !== 0 ? ((currentVal - lotMedVal) / Math.abs(lotMedVal)) * 100 : 0;
      whatHappened += `This part deviates by ${pctDiff >= 0 ? "+" : ""}${pctDiff.toFixed(1)}% from the lot median baseline (${lotMedVal.toFixed(3)} ${unit}, MAD = ${lotMadVal?.toFixed(3)} ${unit}), registering a severe Robust Z-score of ${robustZScore.toFixed(2)} MAD (Isolation Forest Score = ${isolationForestScore?.toFixed(2)}).`;
    }
  } else if (status === "REVIEW") {
    whatHappened = `MODERATE DRIFT WATCH: Component ${componentId} (Lot ${lotId}) exhibits an elevated ${paramName} reading of ${currentVal.toFixed(3)} ${unit} at ${latestTimeH}h (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% change over interval). `;
    if (lotMedVal !== undefined && robustZScore !== undefined) {
      whatHappened += `The part exhibits a moderate baseline divergence (Robust Z = ${robustZScore.toFixed(2)} MAD relative to lot median ${lotMedVal.toFixed(3)} ${unit}), requiring engineering verification prior to flight integration.`;
    }
  } else {
    whatHappened = `NOMINAL BASELINE ALIGNMENT: Component ${componentId} (Lot ${lotId}) recorded a stable ${paramName} value of ${currentVal.toFixed(3)} ${unit} at ${latestTimeH}h (${valChange >= 0 ? "+" : ""}${valChange.toFixed(3)} ${unit} change). `;
    if (lotMedVal !== undefined && robustZScore !== undefined) {
      whatHappened += `Parameter evolution remains tightly bounded within the statistical lot median envelope (Robust Z = ${robustZScore.toFixed(2)} MAD, Isolation Forest Score = ${isolationForestScore?.toFixed(2)}).`;
    }
  }

  // 2. DYNAMIC "WHY IT OCCURRED" (Scientific Literature Grounding)
  let whyItOccurred = "";
  if (paramName === "DCL") {
    if (status === "HIGH RISK") {
      whyItOccurred = `PHYSICAL MECHANISM ANALYSIS (Ref: Freeman et al., 2018, Springer; NASA GSFC EEE Parts Bulletin, 2016): The observed severe leakage current divergence is consistent with high electric-field-induced oxygen vacancy (Ta2O5-x) mobility within the amorphous Ta2O5 dielectric layer. Under 125°C thermal and rated voltage stress, positively charged oxygen vacancies drift toward the MnO2 cathode interface, lowering the Schottky barrier height and elevating electron injection. High Z-scores (evaluated via Isolation Forest; Liu et al., 2008, IEEE ICDM) indicate potential anode pellet micro-porosity variation or localized oxide thin spots.`;
    } else if (status === "REVIEW") {
      whyItOccurred = `PHYSICAL MECHANISM ANALYSIS (Ref: Freeman et al., 2018; Vishay Reliability Technical Note): The measured current trajectory reflects thermally activated oxygen vacancy redistribution under applied electric field. While current levels remain under absolute limits, early slope elevation indicates subtle dielectric state changes that warrant observation across remaining burn-in checkpoints.`;
    } else {
      whyItOccurred = `PHYSICAL MECHANISM ANALYSIS (Ref: MIL-PRF-55365 Specification Baseline): Dielectric current transport is dominated by normal Poole-Frenkel conduction across a uniform amorphous Ta2O5 dielectric barrier with negligible oxygen vacancy drift or barrier degradation.`;
    }
  } else if (paramName === "RDS_ON") {
    if (status === "HIGH RISK") {
      whyItOccurred = `PHYSICAL MECHANISM ANALYSIS (Ref: MIL-PRF-19500; JEDEC JC-70.1): Elevated on-resistance drift under burn-in stress is consistent with interface state generation (Dit) and trapped charge accumulation near the conduction channel, degrading electron field-effect mobility.`;
    } else if (status === "REVIEW") {
      whyItOccurred = `PHYSICAL MECHANISM ANALYSIS: Mild RDS_on trajectory elevation indicates thermally activated trap state evolution under continuous current and gate electric field stress.`;
    } else {
      whyItOccurred = `PHYSICAL MECHANISM ANALYSIS: Channel conduction remains stable with nominal gate barrier integrity and zero excessive trap generation.`;
    }
  } else {
    whyItOccurred = `PHYSICAL MECHANISM ANALYSIS: Monitored parameter ${paramName} evaluated against applicable high-reliability specification standards (${specCriterion.source}, Ref: ${specCriterion.document_ref}).`;
  }

  // 3. DYNAMIC "WHAT IS PREDICTED"
  let whatIsPredicted = "";
  if (forecastSupported && predicted168hLinear !== undefined && predicted168hRidge !== undefined) {
    whatIsPredicted = `FORECAST & PROJECTION: Early 0h→24h linear extrapolation predicts 168h ${paramName} of ${predicted168hLinear.toFixed(3)} ${unit} (early slope = ${earlySlope.toFixed(4)} ${unit}/h). Regularized LOCO Ridge Regression forecasts 168h ${paramName} at ${predicted168hRidge.toFixed(3)} ${unit}. `;
    if (verdict.predictedLimitExceeded) {
      whatIsPredicted += `CRITICAL WARNING: Forecasted 168h value exceeds the specification limit (${specValue} ${unit}).`;
    } else {
      whatIsPredicted += `Forecasted 168h ${paramName} remains within qualified specification limits (${specValue} ${unit}, remaining margin = ${specMarginPct.toFixed(1)}%).`;
    }
  } else {
    whatIsPredicted = `MONITORING SUMMARY: 168h drift forecast unavailable for parameter ${paramName}. Parameter is tracked via statistical lot dispersion, Median/MAD bounds, and specification limits (${specValue} ${unit}).`;
  }

  // 4. DYNAMIC "ENGINEERING REVIEW GUIDANCE"
  let whatEngineerShouldReview = "";
  const actionItems: ActionItem[] = [];

  if (status === "HIGH RISK") {
    whatEngineerShouldReview = `DISPOSITION GUIDANCE: HIGH RISK ANOMALY — Hold component from payload assembly. Perform thermal chamber log audit, verify burn-in power supply ripple, and submit to Materials Review Board (MRB) for destruct-physical-analysis (DPA) evaluation. MANDATORY POLICY: ANOMALY ≠ PHYSICAL FAILURE.`;
    actionItems.push(
      { id: "mrb", label: "Route Component to Materials Review Board (MRB) Hold", severity: "CRITICAL", mandatory: true },
      { id: "logs", label: "Audit Burn-in Chamber Thermal Logs & Power Ripple", severity: "WARNING", mandatory: true },
      { id: "anneal", label: "Verify Post-Bake Annealing & Room Temperature Recovery", severity: "WARNING", mandatory: false },
      { id: "policy", label: "Policy Reminder: Statistical Anomaly ≠ Physical Component Failure", severity: "INFO", mandatory: true },
    );
  } else if (status === "REVIEW") {
    const dynamicSlope = getDynamicSafetySlopeThreshold(specValue);
    whatEngineerShouldReview = `DISPOSITION GUIDANCE: MODERATE DRIFT — Hold for 96h/168h verification. Confirm whether trajectory flattens or continues accelerating before final flight clearance.`;
    actionItems.push(
      { id: "monitor", label: "Monitor 96h & 168h Intermediate Burn-In Checkpoints", severity: "WARNING", mandatory: true },
      { id: "slope", label: `Verify Drift Rate Remains Below Safety Slope (${dynamicSlope.toFixed(4)} ${unit}/h)`, severity: "WARNING", mandatory: true },
      { id: "retest", label: "Perform Post-Burn-In 25°C Parametric Verification", severity: "INFO", mandatory: false },
    );
  } else {
    whatEngineerShouldReview = `DISPOSITION GUIDANCE: ACCEPT / NOMINAL — Component complies with both dynamic lot baseline envelope and static specification limits for ${paramName}. Authorized for flight integration.`;
    actionItems.push(
      { id: "release", label: "Authorize Component Release for Flight Payload Integration", severity: "INFO", mandatory: true },
      { id: "record", label: "Log Screening Data in Quality Assurance Reliability Record", severity: "INFO", mandatory: true },
    );
  }

  const fullSynthesisText = `${whatHappened}\n\n${whyItOccurred}\n\n${whatIsPredicted}\n\n${whatEngineerShouldReview}`;

  return {
    whatHappened,
    whyItOccurred,
    whatIsPredicted,
    whatEngineerShouldReview,
    fullSynthesisText,
    riskScorePct,
    riskBadgeLabel,
    riskColorHex,
    mechanismCategory,
    actionItems,
    specMarginPct,
    zScoreSeverity,
  };
}

export function generateCompoundMultiParameterNarrative(
  componentId: string,
  lotId: string,
  compoundVerdict: MultiParameterCompoundVerdict
): {
  executiveSummary: string;
  parameterBreakdownText: string;
  recommendedAction: string;
} {
  const { overallStatus, parameterResults } = compoundVerdict;
  const entries = Object.entries(parameterResults);

  const highRisk = entries.filter(([_, v]) => v.status === "HIGH RISK").map(([p]) => p);
  const review = entries.filter(([_, v]) => v.status === "REVIEW").map(([p]) => p);
  const nominal = entries.filter(([_, v]) => v.status === "NORMAL").map(([p]) => p);

  let executiveSummary = "";
  if (overallStatus === "HIGH RISK") {
    executiveSummary = `OVERALL SCREENING VERDICT: HIGH RISK — Component ${componentId} (Lot ${lotId}) exhibits severe parametric nonconformance or outlier behavior in: [${highRisk.join(", ")}]. ${review.length > 0 ? `Additional moderate drift observed in [${review.join(", ")}].` : ""}`;
  } else if (overallStatus === "REVIEW") {
    executiveSummary = `OVERALL SCREENING VERDICT: ENGINEERING REVIEW — Component ${componentId} (Lot ${lotId}) shows elevated drift or baseline dispersion in: [${review.join(", ")}]. All other parameters ([${nominal.join(", ")}]) remain within nominal bounds.`;
  } else {
    executiveSummary = `OVERALL SCREENING VERDICT: ACCEPT / NOMINAL — All ${entries.length} evaluated parameters ([${nominal.join(", ")}]) for component ${componentId} (Lot ${lotId}) operate within nominal lot baseline envelopes and specification bounds.`;
  }

  const breakdownLines = entries.map(([param, res]) => {
    return `• **${param}** [${res.status}]: ${res.verdictSummary}`;
  });
  const parameterBreakdownText = breakdownLines.join("\n");

  let recommendedAction = "";
  if (overallStatus === "HIGH RISK") {
    recommendedAction = "MANDATORY ACTION: Quarantine component from flight lot. Convene Material Review Board (MRB) for destruct-physical analysis and root cause investigation.";
  } else if (overallStatus === "REVIEW") {
    recommendedAction = "RECOMMENDED ACTION: Retain component for extended burn-in monitoring (96h/168h checkpoints). Verify drift stabilization prior to acceptance.";
  } else {
    recommendedAction = "RECOMMENDED ACTION: Authorize component release for flight hardware integration.";
  }

  return {
    executiveSummary,
    parameterBreakdownText,
    recommendedAction,
  };
}
