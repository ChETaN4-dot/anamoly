export type DatasetRow = {
  component_id: string;
  lot_id: string;
  component_type: string;
  capacitance_uF?: number;
  rated_voltage_V?: number;
  test_voltage_V?: number;
  test_temperature_C?: number;
  time_h: number;
  parameter?: string;
  value?: number;
  unit?: string;
  dcl_uA: number; // legacy alias, equal to value
  data_source: string;
  data_type: string;
  line_number?: number;
};

export type ValidationError = {
  row: number;
  field: string;
  message: string;
  value?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  rows: DatasetRow[];
  summary: {
    totalRows: number;
    validRows: number;
    componentCount: number;
    lotCount: number;
    parameters: string[];
    dataTypes: string[];
  };
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function validateCSVContent(csvText: string): ValidationResult {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const errors: ValidationError[] = [];
  const rows: DatasetRow[] = [];

  if (lines.length < 2) {
    return {
      valid: false,
      errors: [{ row: 0, field: "header", message: "CSV file is empty or missing headers." }],
      rows: [],
      summary: { totalRows: 0, validRows: 0, componentCount: 0, lotCount: 0, parameters: [], dataTypes: [] },
    };
  }

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase());

  const getCol = (possibleNames: string[]): number => {
    return headers.findIndex((h) => possibleNames.includes(h));
  };

  const colComponentId = getCol(["component_id", "componentid", "part_id"]);
  const colLotId = getCol(["lot_id", "lotid", "batch_id"]);
  const colComponentType = getCol(["component_type", "componenttype", "type"]);
  const colCapacitance = getCol(["capacitance_uf", "capacitance", "cap_uf"]);
  const colRatedV = getCol(["rated_voltage_v", "rated_voltage", "rated_v"]);
  const colTestV = getCol(["test_voltage_v", "test_voltage", "test_v"]);
  const colTestTemp = getCol(["test_temperature_c", "test_temperature", "temp_c"]);
  const colTime = getCol(["time_h", "time", "time_hours", "checkpoint_h"]);
  const colParam = getCol(["parameter", "param", "param_name", "parameter_name"]);
  const colValue = getCol(["value", "val", "measurement", "reading"]);
  const colUnit = getCol(["unit", "units"]);
  const colDcl = getCol(["dcl_ua", "dcl", "leakage_current_ua", "current_ua"]);
  const colSource = getCol(["data_source", "source"]);
  const colType = getCol(["data_type", "type_tag"]);

  if (colComponentId < 0) errors.push({ row: 1, field: "header", message: "Missing required column: component_id" });
  if (colLotId < 0) errors.push({ row: 1, field: "header", message: "Missing required column: lot_id" });
  if (colTime < 0) errors.push({ row: 1, field: "header", message: "Missing required column: time_h" });
  if (colDcl < 0 && colValue < 0) errors.push({ row: 1, field: "header", message: "Missing measurement column: either 'value' or 'dcl_uA' is required" });

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      rows: [],
      summary: { totalRows: lines.length - 1, validRows: 0, componentCount: 0, lotCount: 0, parameters: [], dataTypes: [] },
    };
  }

  const seenKeys = new Set<string>();
  const componentMetadataMap = new Map<string, { type: string; cap?: number; ratedV?: number; testV?: number; temp?: number }>();

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = parseCSVLine(lines[i]);

    const compId = colComponentId >= 0 ? cells[colComponentId] : "";
    const lotId = colLotId >= 0 ? cells[colLotId] : "";
    const compType = colComponentType >= 0 ? cells[colComponentType] : "Solid MnO2 Tantalum Capacitor";
    const capStr = colCapacitance >= 0 ? cells[colCapacitance] : "";
    const ratedVStr = colRatedV >= 0 ? cells[colRatedV] : "";
    const testVStr = colTestV >= 0 ? cells[colTestV] : "";
    const testTempStr = colTestTemp >= 0 ? cells[colTestTemp] : "125";
    const timeStr = colTime >= 0 ? cells[colTime] : "";
    const paramStr = colParam >= 0 ? cells[colParam] : "DCL";
    const unitStr = colUnit >= 0 ? cells[colUnit] : (paramStr === "DCL" ? "µA" : "unit");
    const valStr = colValue >= 0 ? cells[colValue] : (colDcl >= 0 ? cells[colDcl] : "");
    const source = colSource >= 0 ? cells[colSource] : "UPLOADED_CSV";
    const dataType = colType >= 0 ? cells[colType] : "USER_UPLOADED";

    // Component ID validation
    if (!compId || compId.length === 0) {
      errors.push({ row: lineNumber, field: "component_id", message: "Missing component_id", value: compId });
    }

    // Lot ID validation
    if (!lotId || lotId.length === 0) {
      errors.push({ row: lineNumber, field: "lot_id", message: "Missing lot_id", value: lotId });
    }

    // Time validation
    const timeH = Number(timeStr);
    if (timeStr === "" || isNaN(timeH) || !Number.isFinite(timeH)) {
      errors.push({ row: lineNumber, field: "time_h", message: "Invalid numeric time_h value", value: timeStr });
    } else if (timeH < 0) {
      errors.push({ row: lineNumber, field: "time_h", message: "Negative time_h value is not allowed", value: timeStr });
    }

    // Measurement Value validation
    const numVal = Number(valStr);
    if (valStr === "" || isNaN(numVal) || !Number.isFinite(numVal)) {
      errors.push({ row: lineNumber, field: "value", message: "Invalid numeric measurement value", value: valStr });
    }

    // Optional numeric parsing
    const cap = capStr ? Number(capStr) : undefined;
    const ratedV = ratedVStr ? Number(ratedVStr) : undefined;
    const testV = testVStr ? Number(testVStr) : undefined;
    const tempC = testTempStr ? Number(testTempStr) : undefined;

    // Duplicate check per (component, parameter, time)
    const key = `${compId}::${paramStr}::${timeH}`;
    if (compId && !isNaN(timeH)) {
      if (seenKeys.has(key)) {
        errors.push({ row: lineNumber, field: "duplicate", message: `Duplicate measurement for component ${compId} (${paramStr}) at time ${timeH}h`, value: key });
      } else {
        seenKeys.add(key);
      }
    }

    // Metadata consistency check across time checkpoints
    if (compId) {
      const existing = componentMetadataMap.get(compId);
      if (existing) {
        if (cap !== undefined && existing.cap !== undefined && existing.cap !== cap) {
          errors.push({
            row: lineNumber,
            field: "inconsistent_metadata",
            message: `Inconsistent capacitance for ${compId} (previous: ${existing.cap}, current: ${cap})`,
            value: compId,
          });
        }
      } else {
        componentMetadataMap.set(compId, { type: compType, cap, ratedV, testV, temp: tempC });
      }
    }

    if (errors.length === 0 || errors.every((e) => e.row !== lineNumber)) {
      rows.push({
        component_id: compId,
        lot_id: lotId,
        component_type: compType,
        capacitance_uF: cap,
        rated_voltage_V: ratedV,
        test_voltage_V: testV,
        test_temperature_C: tempC,
        time_h: timeH,
        parameter: paramStr,
        value: numVal,
        unit: unitStr,
        dcl_uA: numVal,
        data_source: source,
        data_type: dataType,
        line_number: lineNumber,
      });
    }
  }

  const componentCount = new Set(rows.map((r) => r.component_id)).size;
  const lotCount = new Set(rows.map((r) => r.lot_id)).size;
  const parameters = Array.from(new Set(rows.map((r) => r.parameter || "DCL")));
  const dataTypes = Array.from(new Set(rows.map((r) => r.data_type)));

  return {
    valid: errors.length === 0,
    errors,
    rows: errors.length === 0 ? rows : [],
    summary: {
      totalRows: lines.length - 1,
      validRows: rows.length,
      componentCount,
      lotCount,
      parameters,
      dataTypes,
    },
  };
}
