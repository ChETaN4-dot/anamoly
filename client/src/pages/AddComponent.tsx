import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, PlusCircle, ShieldAlert, CheckCircle2, ChevronRight, Activity } from "lucide-react";

export default function AddComponent() {
  const [, setLocation] = useLocation();

  const [componentId, setComponentId] = useState("");
  const [lotId, setLotId] = useState("");
  const [componentType, setComponentType] = useState("Solid MnO2 Tantalum Capacitor");
  const [capacitance, setCapacitance] = useState(47);
  const [ratedVoltage, setRatedVoltage] = useState(25);
  const [testVoltage, setTestVoltage] = useState(25);
  const [testTemperature, setTestTemperature] = useState(125);
  const [dataSource, setDataSource] = useState("MANUAL_TEST_ENTRY");

  // Checkpoints
  const [val0h, setVal0h] = useState<string>("0.85");
  const [val24h, setVal24h] = useState<string>("1.20");
  const [val96h, setVal96h] = useState<string>("");
  const [val168h, setVal168h] = useState<string>("");

  const addMutation = trpc.analysis.addComponent.useMutation({
    onSuccess: (res) => {
      toast.success(`Component ${res.component_id} ingested!`, {
        description: "Navigating to Component Drift Analysis...",
      });
      setLocation(`/analysis?componentId=${encodeURIComponent(res.component_id)}`);
    },
    onError: (err) => {
      toast.error("Failed to add component", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!componentId.trim() || !lotId.trim()) {
      toast.error("Validation error", { description: "Component ID and Lot ID are required." });
      return;
    }

    const v0 = parseFloat(val0h);
    const v24 = parseFloat(val24h);

    if (isNaN(v0) || isNaN(v24) || v0 < 0 || v24 < 0) {
      toast.error("Validation error", { description: "Valid non-negative 0h and 24h DCL measurements are required." });
      return;
    }

    const measurements: Array<{ time_h: number; value: number; dcl_uA: number }> = [
      { time_h: 0, value: v0, dcl_uA: v0 },
      { time_h: 24, value: v24, dcl_uA: v24 },
    ];

    if (val96h !== "") {
      const v96 = parseFloat(val96h);
      if (!isNaN(v96) && v96 >= 0) measurements.push({ time_h: 96, value: v96, dcl_uA: v96 });
    }

    if (val168h !== "") {
      const v168 = parseFloat(val168h);
      if (!isNaN(v168) && v168 >= 0) measurements.push({ time_h: 168, value: v168, dcl_uA: v168 });
    }

    addMutation.mutate({
      component_id: componentId.trim(),
      lot_id: lotId.trim(),
      component_type: componentType,
      capacitance_uF: capacitance,
      rated_voltage_V: ratedVoltage,
      test_voltage_V: testVoltage,
      test_temperature_C: testTemperature,
      measurements,
      data_source: dataSource,
      data_type: "MANUAL_ENTRY",
    });
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
          <h1 style={{ fontSize: "2.4rem", margin: 0, fontWeight: 600 }}>Add Single Component Telemetry</h1>
          <p style={{ color: "#9ba69b", margin: "6px 0 0", fontSize: "14px" }}>
            Input individual component burn-in measurements for immediate drift analysis and screening.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
        {/* Component & Lot Metadata */}
        <div style={{ background: "#161a18", border: "1px solid #334038", padding: "25px", borderRadius: "4px" }}>
          <h3 style={{ margin: "0 0 20px", color: "#d6f24a", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <PlusCircle size={18} /> Component Metadata & Ratings
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>COMPONENT ID *</label>
              <input
                type="text"
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                placeholder="e.g. TAL-MANUAL-001"
                required
                style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "10px", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>LOT ID *</label>
              <input
                type="text"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                placeholder="e.g. LOT-NEW-TEST"
                required
                style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "10px", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>CAPACITANCE (µF)</label>
                <input
                  type="number"
                  step="0.1"
                  value={capacitance}
                  onChange={(e) => setCapacitance(parseFloat(e.target.value))}
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "8px", borderRadius: "4px", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>RATED VOLTAGE (V)</label>
                <input
                  type="number"
                  step="1"
                  value={ratedVoltage}
                  onChange={(e) => setRatedVoltage(parseFloat(e.target.value))}
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "8px", borderRadius: "4px", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>TEST VOLTAGE (V)</label>
                <input
                  type="number"
                  step="1"
                  value={testVoltage}
                  onChange={(e) => setTestVoltage(parseFloat(e.target.value))}
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "8px", borderRadius: "4px", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>TEST TEMP (°C)</label>
                <input
                  type="number"
                  step="1"
                  value={testTemperature}
                  onChange={(e) => setTestTemperature(parseFloat(e.target.value))}
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "8px", borderRadius: "4px", fontSize: "13px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>PROVENANCE / DATA SOURCE</label>
              <input
                type="text"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "8px", borderRadius: "4px", fontSize: "13px" }}
              />
            </div>
          </div>
        </div>

        {/* Checkpoint DCL Measurements & Ingestion */}
        <div style={{ background: "#161a18", border: "1px solid #334038", padding: "25px", borderRadius: "4px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: "0 0 20px", color: "#d6f24a", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={18} /> Burn-In Checkpoint Telemetry (DCL in µA)
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>0H DCL (µA) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={val0h}
                  onChange={(e) => setVal0h(e.target.value)}
                  required
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "10px", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>24H DCL (µA) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={val24h}
                  onChange={(e) => setVal24h(e.target.value)}
                  required
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#fff", padding: "10px", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>96H DCL (µA) (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={val96h}
                  onChange={(e) => setVal96h(e.target.value)}
                  placeholder="Leave empty if missing"
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#8a9588", padding: "10px", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "5px" }}>168H DCL (µA) (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={val168h}
                  onChange={(e) => setVal168h(e.target.value)}
                  placeholder="Leave empty if missing"
                  style={{ width: "100%", background: "#222a25", border: "1px solid #3d4d42", color: "#8a9588", padding: "10px", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Single Component Anomaly Guard Note */}
            <div style={{ background: "#222a25", border: "1px solid #334038", padding: "15px", borderRadius: "4px", fontSize: "12px", color: "#9ba69b", lineHeight: "1.6" }}>
              <strong style={{ color: "#d6f24a", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <ShieldAlert size={14} /> Single Component Analysis Guard
              </strong>
              Single components can be analyzed for time-series drift prediction (0h + 24h → 168h). A single component in a new lot cannot establish a lot-level statistical anomaly until the lot size reaches N ≥ 10 components. Missing future checkpoints are never fabricated.
            </div>
          </div>

          <button
            type="submit"
            disabled={addMutation.isPending}
            className="button button--signal"
            style={{ width: "100%", marginTop: "25px", padding: "14px", fontSize: "15px" }}
          >
            {addMutation.isPending ? "Ingesting Component..." : "Ingest & Analyze Component Drift"} <ChevronRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
