export type EngineeringCriterion = {
  criterion_id: string;
  criterion_name: string;
  parameter: string;
  value: number;
  minValue?: number;
  maxValue?: number;
  unit: string;
  component_type: string;
  component_applicability: string;
  source: string;
  document_ref: string;
  description: string;
  isTwoSided?: boolean;
};

export const ENGINEERING_CRITERIA: EngineeringCriterion[] = [
  // 1. Tantalum Capacitors
  {
    criterion_id: "SPEC-TANTALUM-STD-25V-DCL",
    criterion_name: "Standard Solid Tantalum ESS DCL Ceiling",
    parameter: "DCL",
    value: 50.0,
    maxValue: 50.0,
    unit: "µA",
    component_type: "Solid MnO2 Tantalum Capacitor",
    component_applicability: "47µF / 25V Rated MnO2 Tantalum Capacitors (Synthetic/Commercial)",
    source: "MIL-PRF-55365 / Manufacturer Datasheet Standard",
    document_ref: "MIL-PRF-55365 Table I",
    description: "Maximum allowable direct current leakage (DCL) ceiling under 25V rated test conditions prior to screening nonconformance rejection.",
  },
  {
    criterion_id: "SPEC-TANTALUM-HALT-35V-DCL",
    criterion_name: "HALT Accelerated Life Test High-Rel DCL Ceiling",
    parameter: "DCL",
    value: 1.7,
    maxValue: 1.7,
    unit: "µA",
    component_type: "Solid MnO2 Tantalum Capacitor",
    component_applicability: "6.8µF / 35V Rated MnO2 Tantalum Capacitors (NASA HALT Test Series)",
    source: "NASA GSFC / Teverovsky 2016 RAMS Proceedings",
    document_ref: "NASA GSFC NTRS 20160001192 Section 3",
    description: "Critical DCL parametric failure threshold under 85°C / 25V post-HALT stress monitoring.",
  },
  {
    criterion_id: "SPEC-TANTALUM-ESR",
    criterion_name: "Tantalum Equivalent Series Resistance Ceiling",
    parameter: "ESR",
    value: 1.2,
    maxValue: 1.2,
    unit: "Ω",
    component_type: "Solid MnO2 Tantalum Capacitor",
    component_applicability: "Tantalum Capacitors @ 100 kHz ESS",
    source: "MIL-PRF-55365 Specification",
    document_ref: "MIL-PRF-55365 Table II",
    description: "Maximum allowable ESR at 100 kHz. Elevated ESR indicates internal cathode/anode interface degradation.",
  },
  {
    criterion_id: "SPEC-TANTALUM-CAP-47UF",
    criterion_name: "Capacitance Tolerance Window (47µF ±10%)",
    parameter: "CAP",
    value: 47.0,
    minValue: 42.3,
    maxValue: 51.7,
    unit: "µF",
    component_type: "Solid MnO2 Tantalum Capacitor",
    component_applicability: "47µF Rated Tantalum Capacitors (±10% Tolerance)",
    source: "MIL-PRF-55365 Table I",
    document_ref: "MIL-PRF-55365 Paragraph 3.8",
    description: "Acceptable capacitance band: 42.3 µF to 51.7 µF.",
    isTwoSided: true,
  },
  {
    criterion_id: "SPEC-TANTALUM-CAP-6.8UF",
    criterion_name: "Capacitance Tolerance Window (6.8µF ±10%)",
    parameter: "CAP",
    value: 6.8,
    minValue: 6.12,
    maxValue: 7.48,
    unit: "µF",
    component_type: "Solid MnO2 Tantalum Capacitor",
    component_applicability: "6.8µF Rated Tantalum Capacitors (±10% Tolerance)",
    source: "NASA GSFC / MIL-PRF-55365",
    document_ref: "NASA GSFC NTRS 20160001192",
    description: "Acceptable capacitance band: 6.12 µF to 7.48 µF.",
    isTwoSided: true,
  },
  {
    criterion_id: "SPEC-TANTALUM-DF",
    criterion_name: "Dissipation Factor Maximum Ceiling",
    parameter: "DF",
    value: 6.0,
    maxValue: 6.0,
    unit: "%",
    component_type: "Solid MnO2 Tantalum Capacitor",
    component_applicability: "Standard Solid Tantalum Capacitors @ 120 Hz",
    source: "MIL-PRF-55365 Specification",
    document_ref: "MIL-PRF-55365 Paragraph 3.9",
    description: "Maximum allowable dissipation factor (tan δ) at 120 Hz.",
  },

  // 2. Power MOSFETs
  {
    criterion_id: "SPEC-MOSFET-RDSON",
    criterion_name: "Power MOSFET On-State Resistance Ceiling",
    parameter: "RDS_ON",
    value: 25.0,
    maxValue: 25.0,
    unit: "mΩ",
    component_type: "Power MOSFET",
    component_applicability: "Rad-Hard / High-Rel Silicon Power MOSFET",
    source: "MIL-PRF-19500 / AEC-Q101",
    document_ref: "MIL-PRF-19500 / Slash Sheet Standard",
    description: "Maximum on-resistance (RDS_on) at VGS = 10V, ID = rated. Thermal channel degradation causes upward drift.",
  },
  {
    criterion_id: "SPEC-MOSFET-VTH",
    criterion_name: "Power MOSFET Threshold Voltage Band",
    parameter: "VTH",
    value: 3.0,
    minValue: 2.0,
    maxValue: 4.0,
    unit: "V",
    component_type: "Power MOSFET",
    component_applicability: "Silicon Power MOSFET Gate Threshold",
    source: "MIL-PRF-19500 / AEC-Q101",
    document_ref: "MIL-PRF-19500 Appendix E",
    description: "Acceptable gate threshold voltage band (2.0V - 4.0V). Shift indicates gate oxide charge trapping.",
    isTwoSided: true,
  },
  {
    criterion_id: "SPEC-MOSFET-IGSS",
    criterion_name: "Power MOSFET Gate Leakage Ceiling",
    parameter: "IGSS",
    value: 100.0,
    maxValue: 100.0,
    unit: "nA",
    component_type: "Power MOSFET",
    component_applicability: "Silicon Power MOSFET Gate-Source",
    source: "MIL-PRF-19500",
    document_ref: "MIL-PRF-19500 Table IV",
    description: "Maximum gate-source leakage current at VGS = ±20V.",
  },
  {
    criterion_id: "SPEC-MOSFET-IDSS",
    criterion_name: "Power MOSFET Drain Leakage Ceiling",
    parameter: "IDSS",
    value: 1.0,
    maxValue: 1.0,
    unit: "µA",
    component_type: "Power MOSFET",
    component_applicability: "Silicon Power MOSFET Drain-Source",
    source: "MIL-PRF-19500",
    document_ref: "MIL-PRF-19500 Table IV",
    description: "Maximum zero-gate-voltage drain current at VDS = rated.",
  },

  // 3. GaN HEMTs
  {
    criterion_id: "SPEC-GAN-RDSON",
    criterion_name: "GaN HEMT On-State Resistance Ceiling",
    parameter: "RDS_ON",
    value: 15.0,
    maxValue: 15.0,
    unit: "mΩ",
    component_type: "GaN HEMT",
    component_applicability: "Enhancement-Mode GaN Power Transistor",
    source: "JEDEC JC-70.1 / AEC-Q101",
    document_ref: "JESD22-A108 / JEP180",
    description: "Maximum RDS_on for GaN HEMT. Trapping effects (dynamic RDS_on) lead to post-stress drift.",
  },
  {
    criterion_id: "SPEC-GAN-VTH",
    criterion_name: "GaN HEMT Gate Threshold Band",
    parameter: "VTH",
    value: 1.7,
    minValue: 1.2,
    maxValue: 2.5,
    unit: "V",
    component_type: "GaN HEMT",
    component_applicability: "e-GaN Power Device Gate Threshold",
    source: "JEDEC JC-70.1 Standard",
    document_ref: "JEP180 Guidelines",
    description: "GaN threshold voltage window (1.2V - 2.5V). Sensitive to gate barrier degradation.",
    isTwoSided: true,
  },
  {
    criterion_id: "SPEC-GAN-IGSS",
    criterion_name: "GaN HEMT Gate Leakage Ceiling",
    parameter: "IGSS",
    value: 50.0,
    maxValue: 50.0,
    unit: "nA",
    component_type: "GaN HEMT",
    component_applicability: "GaN Gate Dielectric / Schottky Gate",
    source: "JEDEC JC-70.1 Standard",
    document_ref: "JESD22-A108",
    description: "Maximum gate leakage current at rated gate bias.",
  },

  // 4. SiC MOSFETs
  {
    criterion_id: "SPEC-SIC-RDSON",
    criterion_name: "SiC MOSFET On-State Resistance Ceiling",
    parameter: "RDS_ON",
    value: 35.0,
    maxValue: 35.0,
    unit: "mΩ",
    component_type: "SiC MOSFET",
    component_applicability: "1200V / 650V High-Voltage SiC Power MOSFET",
    source: "MIL-PRF-19500 / AEC-Q101",
    document_ref: "MIL-PRF-19500 / ECSS-Q-ST-60C",
    description: "Maximum RDS_on for SiC MOSFET at rated test current.",
  },
  {
    criterion_id: "SPEC-SIC-VTH",
    criterion_name: "SiC MOSFET Gate Threshold Band",
    parameter: "VTH",
    value: 3.2,
    minValue: 2.0,
    maxValue: 5.0,
    unit: "V",
    component_type: "SiC MOSFET",
    component_applicability: "SiC Gate Oxide (BTI Screening)",
    source: "MIL-PRF-19500 / AEC-Q101",
    document_ref: "MIL-PRF-19500 Appendix G",
    description: "Acceptable SiC threshold window (2.0V - 5.0V). BTI (Bias Temperature Instability) causes drift.",
    isTwoSided: true,
  },
  {
    criterion_id: "SPEC-SIC-IDSS",
    criterion_name: "SiC MOSFET Off-State Drain Leakage Ceiling",
    parameter: "IDSS",
    value: 5.0,
    maxValue: 5.0,
    unit: "µA",
    component_type: "SiC MOSFET",
    component_applicability: "High-Voltage SiC Drain-Source Breakdown",
    source: "MIL-PRF-19500 Specification",
    document_ref: "MIL-PRF-19500 Table VI",
    description: "Maximum high-voltage drain leakage current.",
  },
];

export function getEngineeringCriterionForComponent(
  capacitance_uF?: number,
  rated_voltage_V?: number,
  componentType?: string,
  parameter: string = "DCL"
): EngineeringCriterion {
  const normParam = parameter.toUpperCase().trim();
  const normType = (componentType || "Solid MnO2 Tantalum Capacitor").toLowerCase();

  // 1. Tantalum Capacitor matching
  if (normType.includes("tantalum") || normType.includes("capacitor")) {
    if (normParam === "DCL" || normParam === "IDDQ" || normParam === "CURRENT") {
      if (capacitance_uF === 6.8 && rated_voltage_V === 35) {
        return ENGINEERING_CRITERIA[1]; // NASA HALT 1.7 uA
      }
      return ENGINEERING_CRITERIA[0]; // 50 uA Standard
    }
    if (normParam === "ESR") return ENGINEERING_CRITERIA[2];
    if (normParam === "CAP" || normParam === "CAPACITANCE") {
      return capacitance_uF === 6.8 ? ENGINEERING_CRITERIA[4] : ENGINEERING_CRITERIA[3];
    }
    if (normParam === "DF" || normParam === "DISSIPATION_FACTOR") return ENGINEERING_CRITERIA[5];
  }

  // 2. Power MOSFET matching
  if (normType.includes("mosfet") && !normType.includes("sic")) {
    if (normParam === "RDS_ON" || normParam === "RDSON") return ENGINEERING_CRITERIA[6];
    if (normParam === "VTH") return ENGINEERING_CRITERIA[7];
    if (normParam === "IGSS") return ENGINEERING_CRITERIA[8];
    if (normParam === "IDSS") return ENGINEERING_CRITERIA[9];
  }

  // 3. GaN HEMT matching
  if (normType.includes("gan") || normType.includes("hemt")) {
    if (normParam === "RDS_ON" || normParam === "RDSON") return ENGINEERING_CRITERIA[10];
    if (normParam === "VTH") return ENGINEERING_CRITERIA[11];
    if (normParam === "IGSS") return ENGINEERING_CRITERIA[12];
  }

  // 4. SiC MOSFET matching
  if (normType.includes("sic")) {
    if (normParam === "RDS_ON" || normParam === "RDSON") return ENGINEERING_CRITERIA[13];
    if (normParam === "VTH") return ENGINEERING_CRITERIA[14];
    if (normParam === "IDSS") return ENGINEERING_CRITERIA[15];
  }

  // Fallback: match by parameter name from criteria list
  const match = ENGINEERING_CRITERIA.find(c => c.parameter === normParam);
  if (match) return match;

  // Generic fallback
  return {
    criterion_id: `SPEC-GENERIC-${normParam}`,
    criterion_name: `General Screening Ceiling for ${normParam}`,
    parameter: normParam,
    value: 100.0,
    maxValue: 100.0,
    unit: "unit",
    component_type: componentType || "Generic EEE Part",
    component_applicability: "General Electronic Component Qualification",
    source: "General Engineering Standard",
    document_ref: "MIL-STD-883 / MIL-STD-750",
    description: `Configured screening ceiling for parameter ${normParam}.`,
  };
}

export function isValueExceedingSpec(val: number, criterion: EngineeringCriterion): boolean {
  if (criterion.isTwoSided && criterion.minValue !== undefined && criterion.maxValue !== undefined) {
    return val < criterion.minValue || val > criterion.maxValue;
  }
  if (criterion.maxValue !== undefined) {
    return val > criterion.maxValue;
  }
  return val > criterion.value;
}
