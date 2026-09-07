import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { initSqliteDb, closeDb, insertBatchMeasurements, saveAnalysisRunRecord, listAnalysisHistory, getHistoricalRun, getDatabaseStats } from "./db";
import fs from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.resolve(process.cwd(), "data", "test-persistence.db");

describe("SQLite Persistence & Transaction Layer", () => {
  beforeEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  });

  it("initializes SQLite with WAL mode, foreign keys, and tables", () => {
    const db = initSqliteDb(TEST_DB_PATH);
    const journalMode = (db.prepare("PRAGMA journal_mode;").get() as any)?.journal_mode;
    const foreignKeys = (db.prepare("PRAGMA foreign_keys;").get() as any)?.foreign_keys;

    expect(journalMode.toLowerCase()).toBe("wal");
    expect(foreignKeys).toBe(1);

    const stats = getDatabaseStats();
    expect(stats.connected).toBe(true);
  });

  it("atomically commits batch dataset measurements", () => {
    initSqliteDb(TEST_DB_PATH);

    const rows = [
      {
        component_id: "TEST-001",
        lot_id: "LOT-T1",
        component_type: "Solid MnO2 Tantalum Capacitor",
        parameter: "DCL",
        value: 1.25,
        unit: "µA",
        time_h: 0,
        provenance: "Test Dataset",
        data_type: "SYNTHETIC_DATA",
        data_source: "Unit Test",
      },
      {
        component_id: "TEST-001",
        lot_id: "LOT-T1",
        component_type: "Solid MnO2 Tantalum Capacitor",
        parameter: "DCL",
        value: 1.85,
        unit: "µA",
        time_h: 24,
        provenance: "Test Dataset",
        data_type: "SYNTHETIC_DATA",
        data_source: "Unit Test",
      },
    ];

    const result = insertBatchMeasurements(rows, {
      id: "DATASET-T1",
      name: "Test Dataset T1",
      version: "1.0",
      provenance: "Test provenance",
      data_type: "SYNTHETIC_DATA",
    });

    expect(result.insertedCount).toBe(2);

    const stats = getDatabaseStats();
    expect(stats.totalMeasurements).toBe(2);
    expect(stats.totalComponents).toBe(1);
    expect(stats.totalLots).toBe(1);
  });

  it("rolls back the entire batch if any invalid row is encountered", () => {
    initSqliteDb(TEST_DB_PATH);

    const rowsWithBadData = [
      {
        component_id: "TEST-VALID",
        lot_id: "LOT-T1",
        component_type: "Power MOSFET",
        parameter: "RDS_ON",
        value: 15.0,
        unit: "mΩ",
        time_h: 0,
        provenance: "Test",
        data_type: "SYNTHETIC_DATA",
        data_source: "Test",
      },
      {
        component_id: "", // INVALID missing ID
        lot_id: "LOT-T1",
        component_type: "Power MOSFET",
        parameter: "RDS_ON",
        value: 16.0,
        unit: "mΩ",
        time_h: 24,
        provenance: "Test",
        data_type: "SYNTHETIC_DATA",
        data_source: "Test",
      },
    ];

    expect(() => {
      insertBatchMeasurements(rowsWithBadData as any, {
        id: "DATASET-FAIL",
        name: "Failing Dataset",
        version: "1.0",
        provenance: "Test",
        data_type: "SYNTHETIC_DATA",
      });
    }).toThrow();

    const stats = getDatabaseStats();
    expect(stats.totalMeasurements).toBe(0); // Proves full rollback occurred
  });

  it("persists analysis runs and historical records across database closure and restart", () => {
    // Phase 1: Open DB and save analysis run
    const db1 = initSqliteDb(TEST_DB_PATH);

    const runData = {
      runKey: "RUN-TEST-PERSIST-999",
      componentId: "COMP-PERSIST-1",
      lotId: "LOT-PERSIST",
      parameter: "DCL",
      decision: "HIGH RISK" as const,
      robustZ: 4.82,
      ifScore: 0.68,
      predicted168h: 18.5,
      specLimit: 50.0,
      specLimitExceeded: false,
      reasonCode: "SEVERE_LOT_ANOMALY",
      explanation: "Severe outlier in DCL requiring engineering review",
      modelVersion: "isolation-forest-v1",
    };

    const saved = saveAnalysisRunRecord(runData);
    expect(saved.runId).toBeDefined();

    // Phase 2: Close DB and simulate server restart
    closeDb();

    // Phase 3: Reopen DB and retrieve historical analysis
    const db2 = initSqliteDb(TEST_DB_PATH);
    const history = listAnalysisHistory(10);

    expect(history.length).toBe(1);
    expect(history[0].runKey).toBe("RUN-TEST-PERSIST-999");
    expect(history[0].decision).toBe("HIGH RISK");
    expect(history[0].robustZ).toBeCloseTo(4.82, 2);

    const single = getHistoricalRun("RUN-TEST-PERSIST-999");
    expect(single).toBeDefined();
    expect(single.explanation).toContain("Severe outlier in DCL");
  });
});
