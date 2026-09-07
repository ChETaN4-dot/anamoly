import { describe, expect, it } from "vitest";
import { getEngineeringCriterionForComponent, isValueExceedingSpec } from "../data/engineeringCriteria";
import { evaluateUnifiedRisk, evaluateMultiParameterRisk } from "./riskEngine";
import { analyzeLotAnomalies } from "./lotAnomaly";
import { analyzeComponentDrift } from "./driftModels";

describe("Multi-Parameter Screening & Compound Risk Pipeline", () => {
  it("resolves correct engineering criteria across component families", () => {
    // 1. Tantalum DCL (NASA 6.8uF/35V vs standard 47uF/25V)
    const nasaDclSpec = getEngineeringCriterionForComponent(6.8, 35, "Solid MnO2 Tantalum Capacitor", "DCL");
    expect(nasaDclSpec.value).toBe(1.7);

    const stdDclSpec = getEngineeringCriterionForComponent(47, 25, "Solid MnO2 Tantalum Capacitor", "DCL");
    expect(stdDclSpec.value).toBe(50.0);

    // 2. Tantalum ESR & DF
    const esrSpec = getEngineeringCriterionForComponent(47, 25, "Solid MnO2 Tantalum Capacitor", "ESR");
    expect(esrSpec.value).toBe(1.2);
    expect(esrSpec.unit).toBe("Ω");

    // 3. Power MOSFET RDS_ON & VTH
    const rdsSpec = getEngineeringCriterionForComponent(undefined, 100, "Power MOSFET", "RDS_ON");
    expect(rdsSpec.value).toBe(25.0);
    expect(rdsSpec.unit).toBe("mΩ");

    const vthSpec = getEngineeringCriterionForComponent(undefined, 100, "Power MOSFET", "VTH");
    expect(vthSpec.minValue).toBe(2.0);
    expect(vthSpec.maxValue).toBe(4.0);
    expect(isValueExceedingSpec(1.8, vthSpec)).toBe(true);
    expect(isValueExceedingSpec(3.0, vthSpec)).toBe(false);

    // 4. GaN HEMT & SiC MOSFET
    const ganRdsSpec = getEngineeringCriterionForComponent(undefined, 650, "GaN HEMT", "RDS_ON");
    expect(ganRdsSpec.value).toBe(15.0);

    const sicIdssSpec = getEngineeringCriterionForComponent(undefined, 1200, "SiC MOSFET", "IDSS");
    expect(sicIdssSpec.value).toBe(5.0);
  });

  it("aggregates compound risk without one parameter incorrectly overriding another", () => {
    // Case 1: All parameters NORMAL -> Overall NORMAL
    const allNormal = [
      evaluateUnifiedRisk({ measuredValue: 0.8, specLimit: 50.0, parameterName: "DCL", unit: "µA", robustZScore: 0.5, isolationForestScore: 0.45 }),
      evaluateUnifiedRisk({ measuredValue: 0.35, specLimit: 1.2, parameterName: "ESR", unit: "Ω", robustZScore: 0.2, isolationForestScore: 0.40 }),
      evaluateUnifiedRisk({ measuredValue: 47.1, specLimit: 47.0, minValue: 42.3, maxValue: 51.7, isTwoSided: true, parameterName: "CAP", unit: "µF" }),
    ];
    const verdict1 = evaluateMultiParameterRisk(allNormal);
    expect(verdict1.overallStatus).toBe("NORMAL");
    expect(verdict1.flaggedParametersCount).toBe(0);

    // Case 2: One parameter HIGH RISK, others NORMAL -> Overall HIGH RISK
    const dclOutlier = [
      evaluateUnifiedRisk({ measuredValue: 9.5, specLimit: 50.0, parameterName: "DCL", unit: "µA", robustZScore: 4.6, isolationForestScore: 0.65 }),
      evaluateUnifiedRisk({ measuredValue: 0.35, specLimit: 1.2, parameterName: "ESR", unit: "Ω", robustZScore: 0.2, isolationForestScore: 0.40 }),
    ];
    const verdict2 = evaluateMultiParameterRisk(dclOutlier);
    expect(verdict2.overallStatus).toBe("HIGH RISK");
    expect(verdict2.flaggedParametersCount).toBe(1);
    expect(verdict2.parameterResults["DCL"].status).toBe("HIGH RISK");
    expect(verdict2.parameterResults["ESR"].status).toBe("NORMAL");

    // Case 3: Compound multi-parameter risk (DCL REVIEW + ESR HIGH RISK) -> Overall HIGH RISK
    const compound = [
      evaluateUnifiedRisk({ measuredValue: 2.8, specLimit: 50.0, parameterName: "DCL", unit: "µA", robustZScore: 2.8, isolationForestScore: 0.56 }),
      evaluateUnifiedRisk({ measuredValue: 1.45, specLimit: 1.2, parameterName: "ESR", unit: "Ω", robustZScore: 3.9, isolationForestScore: 0.62 }),
    ];
    const verdict3 = evaluateMultiParameterRisk(compound);
    expect(verdict3.overallStatus).toBe("HIGH RISK");
    expect(verdict3.flaggedParametersCount).toBe(2);
  });

  it("marks forecast unavailable for non-drift parameters while retaining screening", () => {
    // Check TAN-01-001 for CAP
    const capDrift = analyzeComponentDrift("TAN-01-001", "CAP");
    expect(capDrift.driftSupported).toBe(false);
    expect(capDrift.forecastStatus).toBe("UNAVAILABLE");
    expect(capDrift.currentValue).toBeGreaterThan(40);
    expect(capDrift.forecastNotice).toContain("Forecast unavailable for this parameter");
  });

  it("screens lot anomalies accurately across 1000+ demo dataset lots and parameters", () => {
    // Screen LOT-TAN-01 for DCL
    const lotResDcl = analyzeLotAnomalies("LOT-TAN-01", "DCL");
    expect(lotResDcl.sufficient).toBe(true);
    expect(lotResDcl.totalComponentsInLot).toBe(12);

    // Screen LOT-MOS-01 for RDS_ON
    const lotResMos = analyzeLotAnomalies("LOT-MOS-01", "RDS_ON");
    expect(lotResMos.sufficient).toBe(true);
    expect(lotResMos.totalComponentsInLot).toBe(10);
    expect(lotResMos.components.some(c => c.componentId === "MOS-01-004" && c.status === "HIGH RISK")).toBe(true);
  });
});
