import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DatasetRow, validateCSVContent } from "./csvValidator";
import { getDb, insertBatchMeasurements, DbMeasurementRow, getDatabaseStats } from "../db";

export type ComponentSummary = {
  component_id: string;
  lot_id: string;
  component_type: string;
  capacitance_uF?: number;
  rated_voltage_V?: number;
  test_voltage_V?: number;
  test_temperature_C?: number;
  data_source: string;
  data_type: string;
  available_parameters: string[];
  available_checkpoints: number[];
  measurements: Array<{ time_h: number; dcl_uA: number; parameter: string; value: number; unit: string }>;
};

class DatasetStore {
  private initialized = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.initialized) return;
    try {
      const db = getDb();
      const stats = getDatabaseStats();

      // Seed SQLite database from CSVs if SQLite is empty
      if (stats.totalMeasurements === 0) {
        console.log("[DatasetStore] Initializing SQLite database with standard & demo datasets...");

        // 1. Load 1000+ row structured demonstration dataset
        const demoPath = join(process.cwd(), "server", "data", "burnin_sentinel_demo_1000plus.csv");
        if (existsSync(demoPath)) {
          const content = readFileSync(demoPath, "utf-8");
          const res = validateCSVContent(content);
          if (res.valid) {
            insertBatchMeasurements(
              res.rows.map(r => ({
                component_id: r.component_id,
                lot_id: r.lot_id,
                component_type: r.component_type,
                parameter: r.parameter || "DCL",
                value: r.value ?? r.dcl_uA,
                unit: r.unit || "unit",
                time_h: r.time_h,
                test_temperature_C: r.test_temperature_C,
                test_voltage_V: r.test_voltage_V,
                capacitance_uF: r.capacitance_uF,
                rated_voltage_V: r.rated_voltage_V,
                provenance: "Synthetic engineering demonstration dataset",
                data_type: "SYNTHETIC_DATA",
                data_source: r.data_source,
              })),
              {
                id: "DEMO-1000PLUS",
                name: "Burn-In Sentinel Structured Multi-Parameter Demo Dataset",
                version: "2.0.0",
                provenance: "Literature-calibrated synthetic demonstration data",
                data_type: "SYNTHETIC_DATA",
              }
            );
          }
        }

        // 2. Load synthetic baseline dataset
        const syntheticPath = join(process.cwd(), "server", "data", "synthetic_tantalum_dcl.csv");
        if (existsSync(syntheticPath)) {
          const content = readFileSync(syntheticPath, "utf-8");
          const res = validateCSVContent(content);
          if (res.valid) {
            insertBatchMeasurements(
              res.rows.map(r => ({
                component_id: r.component_id,
                lot_id: r.lot_id,
                component_type: r.component_type,
                parameter: "DCL",
                value: r.dcl_uA,
                unit: "µA",
                time_h: r.time_h,
                test_temperature_C: r.test_temperature_C,
                test_voltage_V: r.test_voltage_V,
                capacitance_uF: r.capacitance_uF,
                rated_voltage_V: r.rated_voltage_V,
                provenance: "Synthetic baseline evaluation dataset",
                data_type: "SYNTHETIC_DATA",
                data_source: r.data_source,
              })),
              {
                id: "SYNTHETIC-TANTALUM-54",
                name: "Synthetic Tantalum Evaluation Baseline",
                version: "1.0.0",
                provenance: "Synthetic evaluation dataset",
                data_type: "SYNTHETIC_DATA",
              }
            );
          }
        }

        // 3. Load real NASA experimental dataset
        const realPath = join(process.cwd(), "server", "data", "real_tantalum_dcl.csv");
        if (existsSync(realPath)) {
          const content = readFileSync(realPath, "utf-8");
          const res = validateCSVContent(content);
          if (res.valid) {
            insertBatchMeasurements(
              res.rows.map(r => ({
                component_id: r.component_id,
                lot_id: r.lot_id,
                component_type: r.component_type,
                parameter: "DCL",
                value: r.dcl_uA,
                unit: "µA",
                time_h: r.time_h,
                test_temperature_C: r.test_temperature_C,
                test_voltage_V: r.test_voltage_V,
                capacitance_uF: r.capacitance_uF,
                rated_voltage_V: r.rated_voltage_V,
                provenance: "NASA GSFC / Teverovsky 2016 IEEE RAMS Experimental",
                data_type: "REAL_DERIVED",
                data_source: r.data_source,
              })),
              {
                id: "NASA-GSFC-2016",
                name: "NASA GSFC Real Tantalum HALT Experimental",
                version: "1.0.0",
                provenance: "NASA GSFC / Teverovsky 2016 IEEE RAMS Proceedings",
                data_type: "REAL_DERIVED",
              }
            );
          }
        }

        // 4. Load space qualification dataset
        const qualPath = join(process.cwd(), "server", "data", "space_qual_tantalum_dcl.csv");
        if (existsSync(qualPath)) {
          const content = readFileSync(qualPath, "utf-8");
          const res = validateCSVContent(content);
          if (res.valid) {
            insertBatchMeasurements(
              res.rows.map(r => ({
                component_id: r.component_id,
                lot_id: r.lot_id,
                component_type: r.component_type,
                parameter: "DCL",
                value: r.dcl_uA,
                unit: "µA",
                time_h: r.time_h,
                test_temperature_C: r.test_temperature_C,
                test_voltage_V: r.test_voltage_V,
                capacitance_uF: r.capacitance_uF,
                rated_voltage_V: r.rated_voltage_V,
                provenance: "Space qualification screening dataset",
                data_type: "SPACE_QUAL_DERIVED",
                data_source: r.data_source,
              })),
              {
                id: "SPACE-QUAL-DERIVED",
                name: "Space Qualification Screening Series",
                version: "1.0.0",
                provenance: "Space qualification screening protocol",
                data_type: "SPACE_QUAL_DERIVED",
              }
            );
          }
        }

        console.log("[DatasetStore] SQLite persistent database initialized successfully.");
      }

      this.initialized = true;
    } catch (err) {
      console.warn("[DatasetStore] Warning during database initialization:", err);
    }
  }

  public addRows(newRows: DatasetRow[]) {
    const dbRows: DbMeasurementRow[] = newRows.map(r => ({
      component_id: r.component_id,
      lot_id: r.lot_id,
      component_type: r.component_type,
      parameter: r.parameter || "DCL",
      value: r.value ?? r.dcl_uA,
      unit: r.unit || "unit",
      time_h: r.time_h,
      test_temperature_C: r.test_temperature_C,
      test_voltage_V: r.test_voltage_V,
      capacitance_uF: r.capacitance_uF,
      rated_voltage_V: r.rated_voltage_V,
      provenance: r.data_source || "Ingested Telemetry",
      data_type: r.data_type || "USER_INGESTION",
      data_source: r.data_source || "USER_INGESTION",
    }));

    insertBatchMeasurements(dbRows, {
      id: `INGEST-${Date.now()}`,
      name: "User Ingested Telemetry Dataset",
      version: "1.0.0",
      provenance: "User upload / Manual ingestion",
      data_type: newRows[0]?.data_type || "USER_INGESTION",
    });
  }

  public getComponentList(): ComponentSummary[] {
    const db = getDb();
    const comps = db.prepare(`
      SELECT
        c.component_id,
        c.lot_id,
        c.component_type,
        c.capacitance_uF,
        c.rated_voltage_V,
        c.test_voltage_V,
        c.test_temperature_C,
        c.data_source,
        c.data_type
      FROM components c
      ORDER BY c.lot_id, c.component_id
    `).all() as any[];

    const measurements = db.prepare(`
      SELECT
        m.component_id,
        m.parameter,
        m.value,
        m.unit,
        m.time_h
      FROM measurements m
      ORDER BY m.component_id, m.parameter, m.time_h ASC
    `).all() as any[];

    const measMap = new Map<string, Array<{ time_h: number; dcl_uA: number; parameter: string; value: number; unit: string }>>();
    for (const m of measurements) {
      if (!measMap.has(m.component_id)) {
        measMap.set(m.component_id, []);
      }
      const list = measMap.get(m.component_id)!;
      if (!list.some(existing => existing.parameter === m.parameter && existing.time_h === m.time_h)) {
        list.push({
          time_h: m.time_h,
          dcl_uA: m.value,
          parameter: m.parameter,
          value: m.value,
          unit: m.unit,
        });
      }
    }

    return comps.map(c => {
      const cMeas = measMap.get(c.component_id) || [];
      const params = Array.from(new Set(cMeas.map(m => m.parameter)));
      const checkpoints = Array.from(new Set(cMeas.map(m => m.time_h))).sort((a, b) => a - b);

      return {
        component_id: c.component_id,
        lot_id: c.lot_id,
        component_type: c.component_type,
        capacitance_uF: c.capacitance_uF,
        rated_voltage_V: c.rated_voltage_V,
        test_voltage_V: c.test_voltage_V,
        test_temperature_C: c.test_temperature_C,
        data_source: c.data_source,
        data_type: c.data_type,
        available_parameters: params.length > 0 ? params : ["DCL"],
        available_checkpoints: checkpoints,
        measurements: cMeas,
      };
    });
  }

  public getComponent(componentId: string): ComponentSummary | undefined {
    return this.getComponentList().find((c) => c.component_id === componentId);
  }

  public getLotList(): Array<{ lot_id: string; componentCount: number; data_type: string; component_type: string; parameters: string[] }> {
    const db = getDb();
    const lots = db.prepare(`
      SELECT
        l.lot_id,
        l.component_type,
        COUNT(DISTINCT c.component_id) as componentCount,
        COALESCE(MAX(c.data_type), 'SYNTHETIC_DATA') as data_type
      FROM lots l
      LEFT JOIN components c ON l.lot_id = c.lot_id
      GROUP BY l.lot_id, l.component_type
      ORDER BY l.lot_id
    `).all() as any[];

    const lotParams = db.prepare(`
      SELECT DISTINCT lot_id, parameter FROM measurements
    `).all() as any[];

    const paramMap = new Map<string, string[]>();
    for (const lp of lotParams) {
      if (!paramMap.has(lp.lot_id)) {
        paramMap.set(lp.lot_id, []);
      }
      paramMap.get(lp.lot_id)!.push(lp.parameter);
    }

    return lots.map(l => ({
      lot_id: l.lot_id,
      componentCount: Number(l.componentCount),
      data_type: l.data_type,
      component_type: l.component_type,
      parameters: paramMap.get(l.lot_id) || ["DCL"],
    }));
  }

  public getPairedMeasurements(lotId: string, param1: string, param2: string): Array<{ id: string; x: number; y: number }> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        m1.component_id as id,
        m1.value as x,
        m2.value as y
      FROM measurements m1
      JOIN measurements m2 ON
        m1.component_id = m2.component_id AND
        m1.time_h = m2.time_h
      WHERE
        m1.lot_id = ? AND
        m1.parameter = ? AND
        m2.parameter = ?
    `).all(lotId, param1, param2) as any[];

    return rows.map(r => ({
      id: r.id,
      x: Number(r.x),
      y: Number(r.y),
    }));
  }
}

export const datasetStore = new DatasetStore();
