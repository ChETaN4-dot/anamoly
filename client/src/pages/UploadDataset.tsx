import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { validateCSVContent, ValidationResult, ValidationError } from "@shared/csvValidator";
import { ArrowLeft, CheckCircle2, AlertTriangle, FileSpreadsheet, Upload, ChevronRight } from "lucide-react";

export default function UploadDataset() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [fileName, setFileName] = useState<string>("");
  const [csvContent, setCsvContent] = useState<string>("");
  const [clientValidation, setClientValidation] = useState<ValidationResult | null>(null);
  const [ingestedSummary, setIngestedSummary] = useState<{ lotCount: number; componentCount: number; firstLotId?: string; firstCompId?: string } | null>(null);

  const uploadMutation = trpc.analysis.uploadCSV.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const firstRow = data.validation.rows[0];
        setIngestedSummary({
          lotCount: data.validation.summary.lotCount,
          componentCount: data.validation.summary.componentCount,
          firstLotId: firstRow?.lot_id,
          firstCompId: firstRow?.component_id,
        });
        utils.analysis.getComponents.invalidate();
        utils.analysis.getLots.invalidate();
        utils.analysis.getDatabaseStats.invalidate();
        toast.success("Dataset successfully validated & ingested!", {
          description: `Added ${data.validation.summary.componentCount} components across ${data.validation.summary.lotCount} lots into SQLite database.`,
        });
      } else {
        toast.error("Dataset validation failed", {
          description: `Found ${data.validation.errors.length} validation errors.`,
        });
      }
    },
    onError: (err) => {
      toast.error("Upload error", { description: err.message });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const val = validateCSVContent(text);
      setClientValidation(val);
      if (val.valid) {
        uploadMutation.mutate({ csvText: text });
      }
    };
    reader.readAsText(file);
  };

  const handleIngest = () => {
    if (!csvContent) return;
    uploadMutation.mutate({ csvText: csvContent });
  };

  return (
    <div className="site-shell" style={{ background: "#111412", minHeight: "100vh", color: "#edf0e6", padding: "40px 8%" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334038", paddingBottom: "20px", marginBottom: "35px" }}>
        <div>
          <button
            onClick={() => setLocation("/")}
            style={{ background: "none", border: "none", color: "#9ba69b", display: "flex", alignItems: "center", gap: "6px", fontFamily: "IBM Plex Mono", fontSize: "12px", cursor: "pointer", marginBottom: "8px" }}
          >
            <ArrowLeft size={14} /> BACK TO DASHBOARD
          </button>
          <h1 style={{ fontSize: "2.4rem", margin: 0, fontWeight: 600 }}>Upload Burn-In Dataset</h1>
          <p style={{ color: "#9ba69b", margin: "6px 0 0", fontSize: "14px" }}>
            Validate & ingest CSV measurements for lot anomaly detection & component drift analysis.
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
        {/* Left Side: Upload Form & Quick Specs */}
        <div>
          <div style={{ background: "#161a18", border: "1px dashed #526152", padding: "35px", textAlign: "center", borderRadius: "4px", marginBottom: "25px" }}>
            <FileSpreadsheet size={48} style={{ color: "#d6f24a", marginBottom: "15px" }} />
            <h3 style={{ margin: "0 0 10px", fontSize: "18px" }}>Select a CSV File</h3>
            <p style={{ color: "#839087", fontSize: "13px", margin: "0 0 20px" }}>
              File must contain columns: <code style={{ color: "#d6f24a" }}>component_id, lot_id, time_h, dcl_uA</code>
            </p>
            <input
              type="file"
              accept=".csv"
              id="csvFileInput"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <label
              htmlFor="csvFileInput"
              className="button button--signal"
              style={{ display: "inline-flex", cursor: "pointer" }}
            >
              <Upload size={16} /> Choose CSV File
            </label>
            {fileName && (
              <div style={{ marginTop: "15px", fontFamily: "IBM Plex Mono", fontSize: "12px", color: "#d6f24a" }}>
                Selected: {fileName}
              </div>
            )}
            
            <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px dashed #334038" }}>
              <button
                onClick={() => {
                  const sampleCsv = `component_id,lot_id,component_type,capacitance_uF,rated_voltage_V,test_voltage_V,test_temperature_C,time_h,dcl_uA,data_source,data_type
QUAL-001,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.20,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-001,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.42,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-001,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.10,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-001,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.78,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-002,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.15,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-002,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.38,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-002,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.02,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-002,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.65,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-003,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.25,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-003,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.48,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-003,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.18,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-003,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.88,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-004,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.18,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-004,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.40,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-004,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.08,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-004,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.72,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-005,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.22,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-005,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.45,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-005,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.14,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-005,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.82,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-006,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.12,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-006,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.35,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-006,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,1.98,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-006,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.60,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-007,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.24,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-007,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.47,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-007,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.16,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-007,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.85,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-008,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.16,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-008,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.39,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-008,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.05,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-008,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.70,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-009,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.21,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-009,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,1.44,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-009,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,2.12,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-009,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,2.80,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-010,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.40,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-010,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,4.80,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-010,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,14.20,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-010,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,24.50,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-011,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.60,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-011,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,15.80,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-011,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,48.90,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-011,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,88.40,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-012,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,0,1.30,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-012,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,24,3.15,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-012,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,96,6.40,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL
QUAL-012,LOT-QUAL-SPACE-01,MIL-PRF-55365 Tantalum Capacitor (100uF/50V),100,50,50,125,168,9.80,MIL-PRF-55365/4_SPACE_QUAL,SPACE_QUALIFIED_REAL`;
                  setFileName("space_qual_tantalum_dcl.csv");
                  setCsvContent(sampleCsv);
                  const val = validateCSVContent(sampleCsv);
                  setClientValidation(val);
                  if (val.valid) {
                    uploadMutation.mutate({ csvText: sampleCsv });
                  }
                }}
                style={{
                  background: "#1d2420",
                  border: "1px solid #3d4d42",
                  color: "#d6f24a",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  fontFamily: "IBM Plex Mono",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                + Load Space Qual Sample CSV
              </button>
            </div>
          </div>

          {/* Format Requirements Reference */}
          <div style={{ background: "#161a18", border: "1px solid #334038", padding: "20px", borderRadius: "4px" }}>
            <h4 style={{ margin: "0 0 12px", fontFamily: "IBM Plex Mono", fontSize: "12px", color: "#8a9588", letterSpacing: "0.08em" }}>
              REQUIRED SCHEMA & VALIDATION RULES
            </h4>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#a6b0a2", fontSize: "13px", lineHeight: "1.7" }}>
              <li><strong>component_id, lot_id</strong>: Cannot be empty</li>
              <li><strong>time_h</strong>: Non-negative integer (e.g., 0, 24, 96, 168)</li>
              <li><strong>dcl_uA</strong>: Non-negative numeric measurement (leakage current)</li>
              <li><strong>No Duplicates</strong>: (component_id, time_h) must be unique</li>
              <li><strong>Consistent Metadata</strong>: Capacitance & voltage ratings must match across checkpoints</li>
              <li><strong>No Silent Repair</strong>: Invalid rows trigger immediate validation failure</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Validation Results & Actions */}
        <div>
          {clientValidation ? (
            <div style={{ background: "#161a18", border: `1px solid ${clientValidation.valid ? "#4b5a4d" : "#e57463"}`, padding: "25px", borderRadius: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                {clientValidation.valid ? (
                  <>
                    <CheckCircle2 size={24} style={{ color: "#d6f24a" }} />
                    <h3 style={{ margin: 0, color: "#d6f24a", fontSize: "18px" }}>Validation Passed</h3>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={24} style={{ color: "#e57463" }} />
                    <h3 style={{ margin: 0, color: "#e57463", fontSize: "18px" }}>
                      Validation Failed ({clientValidation.errors.length} errors)
                    </h3>
                  </>
                )}
              </div>

              {/* Summary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px", background: "#1d2420", padding: "15px", borderRadius: "4px" }}>
                <div>
                  <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>TOTAL ROWS</span>
                  <div style={{ fontSize: "20px", fontWeight: "bold" }}>{clientValidation.summary.totalRows}</div>
                </div>
                <div>
                  <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>COMPONENTS</span>
                  <div style={{ fontSize: "20px", fontWeight: "bold" }}>{clientValidation.summary.componentCount}</div>
                </div>
                <div>
                  <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>LOTS</span>
                  <div style={{ fontSize: "20px", fontWeight: "bold" }}>{clientValidation.summary.lotCount}</div>
                </div>
              </div>

              {/* Errors List if any */}
              {!clientValidation.valid && (
                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #e5746344", padding: "12px", background: "#251c1c", marginBottom: "20px" }}>
                  {clientValidation.errors.map((err: ValidationError, idx: number) => (
                    <div key={idx} style={{ fontSize: "12px", color: "#f6c4ba", marginBottom: "8px", borderBottom: "1px solid #4a2c2c", paddingBottom: "6px" }}>
                      <strong>Row {err.row}</strong> [{err.field}]: {err.message}
                      {err.value !== undefined && <span style={{ color: "#e57463", marginLeft: "8px" }}>(Got: "{err.value}")</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Ingest Action */}
              <button
                onClick={handleIngest}
                disabled={!clientValidation.valid || uploadMutation.isPending}
                className="button button--signal"
                style={{ width: "100%", opacity: !clientValidation.valid ? 0.5 : 1 }}
              >
                {uploadMutation.isPending ? "Ingesting Dataset..." : "Ingest & Proceed to Drift Analysis"} <ChevronRight size={16} />
              </button>

              {ingestedSummary && (
                <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px solid #334038", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#d6f24a", letterSpacing: "0.1em", fontWeight: 600 }}>
                    ✓ DATASET INGESTED & PERSISTED IN SQLITE DATABASE
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <button
                      onClick={() => setLocation(`/analysis${ingestedSummary.firstCompId ? `?componentId=${ingestedSummary.firstCompId}` : ""}`)}
                      style={{ width: "100%", background: "#d6f24a", border: "none", color: "#111412", padding: "10px", borderRadius: "4px", fontSize: "11px", fontFamily: "IBM Plex Mono", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      Open in Unified Screening Workbench <ChevronRight size={14} />
                    </button>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setLocation(`/module-a${ingestedSummary.firstLotId ? `?lotId=${ingestedSummary.firstLotId}` : ""}`)}
                        style={{ flex: 1, background: "#1a221d", border: "1px solid #3d4d42", color: "#d6f24a", padding: "10px", borderRadius: "4px", fontSize: "11px", fontFamily: "IBM Plex Mono", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        Analyze Lot (Module A) <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => setLocation(`/module-b${ingestedSummary.firstCompId ? `?componentId=${ingestedSummary.firstCompId}` : ""}`)}
                        style={{ flex: 1, background: "#1a221d", border: "1px solid #3d4d42", color: "#edf0e6", padding: "10px", borderRadius: "4px", fontSize: "11px", fontFamily: "IBM Plex Mono", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        Analyze Component (Module B) <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "40px", textAlign: "center", borderRadius: "4px", color: "#8a9588" }}>
              <p>Upload a file to preview validation results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
