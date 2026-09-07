import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

let _db: any = null;
let _currentDbPath: string | null = null;

export function resolveDatabasePath(customUrl?: string): string {
  const envUrl = customUrl || process.env.DATABASE_URL;
  if (envUrl) {
    // If it's a file path or sqlite URI
    const cleaned = envUrl.replace(/^sqlite:\/\//, "");
    return path.isAbsolute(cleaned) ? cleaned : path.resolve(process.cwd(), cleaned);
  }
  return path.resolve(process.cwd(), "data", "burnin-sentinel.db");
}

export function initSqliteDb(customPath?: string): DatabaseSync {
  const dbPath = resolveDatabasePath(customPath);

  // If already initialized for this path, return existing instance
  if (_db && _currentDbPath === dbPath) {
    return _db;
  }

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Enable WAL mode, Foreign Keys, Busy Timeout, Synchronous
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      provenance TEXT NOT NULL,
      data_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dataset_versions (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      version TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lots (
      id TEXT PRIMARY KEY,
      lot_id TEXT UNIQUE NOT NULL,
      component_type TEXT NOT NULL,
      manufacturer TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      component_id TEXT UNIQUE NOT NULL,
      lot_id TEXT NOT NULL,
      component_type TEXT NOT NULL,
      capacitance_uF REAL,
      rated_voltage_V REAL,
      test_voltage_V REAL,
      test_temperature_C REAL,
      data_source TEXT NOT NULL,
      data_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      component_type TEXT NOT NULL,
      parameter TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      time_h REAL NOT NULL,
      test_temperature_C REAL,
      test_voltage_V REAL,
      dataset_id TEXT,
      dataset_version TEXT,
      provenance TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      UNIQUE(component_id, parameter, time_h)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_lot_id_uniq ON lots(lot_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_components_comp_id_uniq ON components(component_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_comp_param_time_uniq ON measurements(component_id, parameter, time_h);
    CREATE INDEX IF NOT EXISTS idx_components_lot_id ON components(lot_id);
    CREATE INDEX IF NOT EXISTS idx_measurements_comp_param_time ON measurements(component_id, parameter, time_h);
    CREATE INDEX IF NOT EXISTS idx_measurements_lot_param ON measurements(lot_id, parameter);

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      run_key TEXT UNIQUE NOT NULL,
      component_id TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      parameter TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_runs_comp ON analysis_runs(component_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_runs_created ON analysis_runs(created_at DESC);

    CREATE TABLE IF NOT EXISTS screening_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      parameter TEXT NOT NULL,
      decision TEXT NOT NULL,
      robust_z REAL,
      if_score REAL,
      predicted_168h REAL,
      spec_limit REAL,
      spec_limit_exceeded INTEGER NOT NULL DEFAULT 0,
      reason_code TEXT NOT NULL,
      explanation TEXT NOT NULL,
      model_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_screening_results_run ON screening_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_screening_results_comp ON screening_results(component_id);

    CREATE TABLE IF NOT EXISTS audit_records (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      result_id TEXT,
      actor TEXT NOT NULL,
      event_type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      name TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      last_signed_in TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  _db = db;
  _currentDbPath = dbPath;
  return db;
}

export function getDb(): DatabaseSync {
  if (!_db) {
    return initSqliteDb();
  }
  return _db;
}

export function closeDb() {
  if (_db) {
    try {
      _db.close();
    } catch {
      // ignore
    }
    _db = null;
    _currentDbPath = null;
  }
}

export type DbMeasurementRow = {
  component_id: string;
  lot_id: string;
  component_type: string;
  parameter: string;
  value: number;
  unit: string;
  time_h: number;
  test_temperature_C?: number;
  test_voltage_V?: number;
  capacitance_uF?: number;
  rated_voltage_V?: number;
  dataset_id?: string;
  dataset_version?: string;
  provenance: string;
  data_type: string;
  data_source: string;
  timestamp?: string;
};

/**
 * Transactional Batch Ingestion:
 * Writes all rows in an atomic transaction. If any error occurs, the entire batch is rolled back.
 */
export function insertBatchMeasurements(
  rows: DbMeasurementRow[],
  datasetInfo: { id: string; name: string; version: string; provenance: string; data_type: string }
): { insertedCount: number } {
  const db = getDb();

  db.exec("BEGIN IMMEDIATE;");
  try {
    // 1. Upsert dataset record
    const insertDataset = db.prepare(`
      INSERT INTO datasets (id, name, version, provenance, data_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        provenance = excluded.provenance,
        data_type = excluded.data_type
    `);
    insertDataset.run(
      datasetInfo.id,
      datasetInfo.name,
      datasetInfo.version,
      datasetInfo.provenance,
      datasetInfo.data_type,
      new Date().toISOString()
    );

    // 2. Insert dataset_version
    const versionId = `${datasetInfo.id}-v${datasetInfo.version}-${Date.now()}`;
    const insertVersion = db.prepare(`
      INSERT INTO dataset_versions (id, dataset_id, version, row_count, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertVersion.run(versionId, datasetInfo.id, datasetInfo.version, rows.length, new Date().toISOString());

    // 3. Prepared statements for components, lots, measurements
    const insertLot = db.prepare(`
      INSERT INTO lots (id, lot_id, component_type, manufacturer, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(lot_id) DO NOTHING
    `);

    const insertComp = db.prepare(`
      INSERT INTO components (
        id, component_id, lot_id, component_type, capacitance_uF,
        rated_voltage_V, test_voltage_V, test_temperature_C, data_source, data_type, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(component_id) DO UPDATE SET
        lot_id = excluded.lot_id,
        component_type = excluded.component_type,
        capacitance_uF = COALESCE(excluded.capacitance_uF, components.capacitance_uF),
        rated_voltage_V = COALESCE(excluded.rated_voltage_V, components.rated_voltage_V),
        test_voltage_V = COALESCE(excluded.test_voltage_V, components.test_voltage_V),
        test_temperature_C = COALESCE(excluded.test_temperature_C, components.test_temperature_C),
        data_source = excluded.data_source,
        data_type = excluded.data_type
    `);

    const insertMeas = db.prepare(`
      INSERT INTO measurements (
        id, component_id, lot_id, component_type, parameter, value, unit,
        time_h, test_temperature_C, test_voltage_V, dataset_id, dataset_version, provenance, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(component_id, parameter, time_h) DO UPDATE SET
        value = excluded.value,
        unit = excluded.unit,
        test_temperature_C = COALESCE(excluded.test_temperature_C, measurements.test_temperature_C),
        test_voltage_V = COALESCE(excluded.test_voltage_V, measurements.test_voltage_V),
        dataset_id = excluded.dataset_id,
        dataset_version = excluded.dataset_version,
        provenance = excluded.provenance,
        timestamp = excluded.timestamp
    `);

    const now = new Date().toISOString();
    const seenLots = new Set<string>();
    const seenComps = new Set<string>();

    for (const r of rows) {
      if (!r.component_id || !r.lot_id || !r.parameter || isNaN(r.value) || isNaN(r.time_h)) {
        throw new Error(`Invalid row data encountered: component_id=${r.component_id}, parameter=${r.parameter}, value=${r.value}`);
      }

      if (!seenLots.has(r.lot_id)) {
        seenLots.add(r.lot_id);
        insertLot.run(nanoid(), r.lot_id, r.component_type || "UNKNOWN", null, now);
      }

      if (!seenComps.has(r.component_id)) {
        seenComps.add(r.component_id);
        insertComp.run(
          nanoid(),
          r.component_id,
          r.lot_id,
          r.component_type || "UNKNOWN",
          r.capacitance_uF ?? null,
          r.rated_voltage_V ?? null,
          r.test_voltage_V ?? null,
          r.test_temperature_C ?? null,
          r.data_source || datasetInfo.provenance,
          r.data_type || datasetInfo.data_type,
          now
        );
      }

      insertMeas.run(
        nanoid(),
        r.component_id,
        r.lot_id,
        r.component_type || "UNKNOWN",
        r.parameter,
        r.value,
        r.unit || "unit",
        r.time_h,
        r.test_temperature_C ?? null,
        r.test_voltage_V ?? null,
        datasetInfo.id,
        datasetInfo.version,
        r.provenance || datasetInfo.provenance,
        r.timestamp || now
      );
    }

    db.exec("COMMIT;");
    return { insertedCount: rows.length };
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

/**
 * Save Analysis Run and Screening Result persistently into SQLite
 */
export function saveAnalysisRunRecord(data: {
  runKey: string;
  componentId: string;
  lotId: string;
  parameter: string;
  requestedBy?: string;
  status?: string;
  decision: "ACCEPT" | "HOLD" | "REJECT" | "NORMAL" | "REVIEW" | "HIGH RISK";
  robustZ?: number;
  ifScore?: number;
  predicted168h?: number;
  specLimit?: number;
  specLimitExceeded?: boolean;
  reasonCode: string;
  explanation: string;
  modelVersion: string;
}): { runId: string; resultId: string } {
  const db = getDb();
  const runId = nanoid();
  const resultId = nanoid();
  const auditId = nanoid();
  const now = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE;");
  try {
    const insertRun = db.prepare(`
      INSERT INTO analysis_runs (id, run_key, component_id, lot_id, parameter, status, requested_by, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRun.run(
      runId,
      data.runKey,
      data.componentId,
      data.lotId,
      data.parameter,
      data.status || "complete",
      data.requestedBy || "QA Engineer",
      now,
      now
    );

    const insertResult = db.prepare(`
      INSERT INTO screening_results (
        id, run_id, component_id, lot_id, parameter, decision,
        robust_z, if_score, predicted_168h, spec_limit, spec_limit_exceeded,
        reason_code, explanation, model_version, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertResult.run(
      resultId,
      runId,
      data.componentId,
      data.lotId,
      data.parameter,
      data.decision,
      data.robustZ ?? null,
      data.ifScore ?? null,
      data.predicted168h ?? null,
      data.specLimit ?? null,
      data.specLimitExceeded ? 1 : 0,
      data.reasonCode,
      data.explanation,
      data.modelVersion,
      now
    );

    const insertAudit = db.prepare(`
      INSERT INTO audit_records (id, run_id, result_id, actor, event_type, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(
      auditId,
      runId,
      resultId,
      data.requestedBy || "QA Engineer",
      data.decision === "ACCEPT" || data.decision === "NORMAL" ? "RELEASED" : data.decision === "REJECT" || data.decision === "HIGH RISK" ? "REJECTED" : "HELD",
      data.explanation,
      now
    );

    db.exec("COMMIT;");
    return { runId, resultId };
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

/**
 * Retrieve Analysis History from SQLite
 */
export function listAnalysisHistory(limit: number = 50): Array<{
  id: string;
  runKey: string;
  componentId: string;
  lotId: string;
  parameter: string;
  status: string;
  decision: string;
  robustZ: number | null;
  ifScore: number | null;
  predicted168h: number | null;
  specLimit: number | null;
  reasonCode: string;
  explanation: string;
  modelVersion: string;
  createdAt: string;
}> {
  const db = getDb();
  const query = db.prepare(`
    SELECT
      r.id,
      r.run_key as runKey,
      r.component_id as componentId,
      r.lot_id as lotId,
      r.parameter,
      r.status,
      res.decision,
      res.robust_z as robustZ,
      res.if_score as ifScore,
      res.predicted_168h as predicted168h,
      res.spec_limit as specLimit,
      res.reason_code as reasonCode,
      res.explanation,
      res.model_version as modelVersion,
      r.created_at as createdAt
    FROM analysis_runs r
    LEFT JOIN screening_results res ON r.id = res.run_id
    ORDER BY r.created_at DESC
    LIMIT ?
  `);
  return query.all(limit) as any[];
}

/**
 * Retrieve single historical run details
 */
export function getHistoricalRun(runKeyOrId: string) {
  const db = getDb();
  const query = db.prepare(`
    SELECT
      r.id,
      r.run_key as runKey,
      r.component_id as componentId,
      r.lot_id as lotId,
      r.parameter,
      r.status,
      res.decision,
      res.robust_z as robustZ,
      res.if_score as ifScore,
      res.predicted_168h as predicted168h,
      res.spec_limit as specLimit,
      res.spec_limit_exceeded as specLimitExceeded,
      res.reason_code as reasonCode,
      res.explanation,
      res.model_version as modelVersion,
      r.created_at as createdAt,
      r.completed_at as completedAt
    FROM analysis_runs r
    LEFT JOIN screening_results res ON r.id = res.run_id
    WHERE r.id = ? OR r.run_key = ?
    LIMIT 1
  `);
  return query.get(runKeyOrId, runKeyOrId) as any;
}

/**
 * Database health metrics
 */
export function getDatabaseStats(): {
  connected: boolean;
  dbPath: string;
  totalComponents: number;
  totalLots: number;
  totalMeasurements: number;
  totalAnalysisRuns: number;
  parameters: string[];
} {
  try {
    const db = getDb();
    const compCount = (db.prepare("SELECT COUNT(*) as count FROM components").get() as any)?.count || 0;
    const lotCount = (db.prepare("SELECT COUNT(*) as count FROM lots").get() as any)?.count || 0;
    const measCount = (db.prepare("SELECT COUNT(*) as count FROM measurements").get() as any)?.count || 0;
    const runCount = (db.prepare("SELECT COUNT(*) as count FROM analysis_runs").get() as any)?.count || 0;
    const params = (db.prepare("SELECT DISTINCT parameter FROM measurements").all() as any[]).map(p => p.parameter);

    return {
      connected: true,
      dbPath: _currentDbPath || resolveDatabasePath(),
      totalComponents: compCount,
      totalLots: lotCount,
      totalMeasurements: measCount,
      totalAnalysisRuns: runCount,
      parameters: params,
    };
  } catch (err) {
    return {
      connected: false,
      dbPath: _currentDbPath || resolveDatabasePath(),
      totalComponents: 0,
      totalLots: 0,
      totalMeasurements: 0,
      totalAnalysisRuns: 0,
      parameters: [],
    };
  }
}

// Compatibility exports for legacy auth / user functions
export async function getUserByOpenId(openId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE open_id = ?").get(openId) as any;
}

export async function upsertUser(user: { openId: string; name?: string | null; email?: string | null; role?: string }) {
  const db = getDb();
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO users (id, open_id, name, email, role, last_signed_in, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(open_id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      last_signed_in = excluded.last_signed_in
  `);
  insert.run(nanoid(), user.openId, user.name || null, user.email || null, user.role || 'user', now, now);
}
