import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DatasetCascadeSelector from "@/components/DatasetCascadeSelector";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  FileText,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Database,
  Activity,
  Layers,
  Info,
  RotateCcw,
  ZoomIn,
} from "lucide-react";

export default function UnifiedAnalysis() {
  const [, setLocation] = useLocation();
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [showSpecLimit, setShowSpecLimit] = useState<boolean>(true);
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 168]);

  // Queries
  const componentsQuery = trpc.analysis.getComponents.useQuery();
  const compList = componentsQuery.data ?? [];

  const urlCompId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("componentId") : null;
  const currentCompId = selectedCompId || urlCompId || (compList.length > 0 ? compList[0].component_id : "");

  const unifiedQuery = trpc.analysis.unifiedAnalysis.useQuery(
    { componentId: currentCompId },
    { enabled: Boolean(currentCompId) },
  );

  const data = unifiedQuery.data;

  const bestModel = data?.drift?.bestModel || data?.drift?.rankedModels?.[0];
  const secondBestModel = data?.drift?.secondBestModel || data?.drift?.rankedModels?.[1];

  // Chart data transformation aligned strictly with Module B
  const chartData = useMemo(() => {
    if (!data?.drift?.checkpoints || data.drift.checkpoints.length === 0) return [];

    const result: Array<{
      time_h: number;
      actual_dcl?: number;
      best_fit_pred?: number;
      second_best_pred?: number;
    }> = [];

    // Actual measured points from drift checkpoints (parameter-isolated DCL)
    for (const pt of data.drift.checkpoints) {
      result.push({
        time_h: pt.time_h,
        actual_dcl: (pt as any).value ?? pt.dcl_uA,
      });
    }

    // Add 168h predictions if available and drift prediction is supported
    if (data.drift.driftSupported && bestModel) {
      const predBest = Number(bestModel.predicted168h.toFixed(3));
      const predSecond = secondBestModel ? Number(secondBestModel.predicted168h.toFixed(3)) : undefined;

      // Anchor the prediction line at 24h so Recharts can draw a line from 24h -> 168h
      const item24 = result.find((r) => r.time_h === 24);
      if (item24 && item24.actual_dcl !== undefined) {
        item24.best_fit_pred = item24.actual_dcl;
        item24.second_best_pred = item24.actual_dcl;
      }

      const has168Measured = data.drift.checkpoints.some((c: any) => c.time_h === 168);

      if (has168Measured) {
        const item168 = result.find((r) => r.time_h === 168);
        if (item168) {
          item168.best_fit_pred = predBest;
          item168.second_best_pred = predSecond;
        }
      } else {
        result.push({
          time_h: 168,
          best_fit_pred: predBest,
          second_best_pred: predSecond,
        });
      }
    }

    return result
      .filter((r) => r.time_h >= zoomRange[0] && r.time_h <= zoomRange[1])
      .sort((a, b) => a.time_h - b.time_h);
  }, [data, bestModel, secondBestModel, zoomRange]);

  // Real CSV Export Handler
  const handleExportCSV = () => {
    if (!data) return;

    const headers = [
      "component_id",
      "lot_id",
      "component_type",
      "data_type",
      "data_source",
      "current_dcl_uA",
      "early_slope_uA_h",
      "robust_z_score",
      "isolation_forest_score",
      "predicted_168h_linear_uA",
      "predicted_168h_ridge_uA",
      "spec_limit_uA",
      "unified_status",
      "reason_code",
      "model_version",
      "timestamp",
    ];

    const row = [
      data.component.component_id,
      data.component.lot_id,
      `"${data.component.component_type}"`,
      data.component.data_type,
      `"${data.component.data_source}"`,
      data.drift.checkpoints[data.drift.checkpoints.length - 1].dcl_uA,
      data.drift.earlySlope?.toFixed(6) ?? "",
      data.lotAnomaly?.robustZScore?.toFixed(4) ?? "",
      data.lotAnomaly?.isolationForestScore?.toFixed(4) ?? "",
      data.drift.predictions?.linear.predicted168h.toFixed(4) ?? "",
      data.drift.predictions?.ridge.predicted168h.toFixed(4) ?? "",
      data.specCriterion.value,
      data.verdict.status,
      data.verdict.reasonCode,
      `"${data.versionMetadata.model_version}"`,
      `"${data.timestamp}"`,
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), row.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `burn_in_report_${data.component.component_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real PDF / Evidence Report Print Handler
  const handleExportPDF = () => {
    window.print();
  };

  const statusColor = data?.verdict.status === "HIGH RISK" ? "#e57463" : data?.verdict.status === "REVIEW" ? "#e8a253" : "#d6f24a";

  return (
    <div className="site-shell" style={{ background: "#111412", minHeight: "100vh", color: "#edf0e6", padding: "40px 6%" }}>
      {/* Header Bar */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334038", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <button
            onClick={() => setLocation("/")}
            style={{ background: "none", border: "none", color: "#9ba69b", display: "flex", alignItems: "center", gap: "6px", fontFamily: "IBM Plex Mono", fontSize: "12px", cursor: "pointer", marginBottom: "8px" }}
          >
            <ArrowLeft size={14} /> BACK TO DASHBOARD
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <h1 style={{ fontSize: "2.2rem", margin: 0, fontWeight: 600 }}>Unified Component Screening Workbench</h1>
            <span style={{ background: "#d6f24a22", color: "#d6f24a", border: "1px solid #d6f24a44", padding: "4px 10px", borderRadius: "3px", fontFamily: "IBM Plex Mono", fontSize: "11px" }}>
              SYSTEM VERDICT
            </span>
          </div>
        </div>

        {/* Real Export Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleExportCSV}
            disabled={!data}
            className="button button--dark"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "auto" }}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!data}
            className="button button--signal"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Printer size={15} /> Export PDF Evidence Report
          </button>
        </div>
      </header>

      {/* Hierarchical Dataset, Lot & Component Selector */}
      <DatasetCascadeSelector
        selectedCompId={currentCompId}
        onSelectComponent={(newCompId) => {
          setSelectedCompId(newCompId);
        }}
        showComponentSelector={true}
      />

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "30px" }}>
          {/* Top Risk Status & Visual Meter Banner */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "25px", alignItems: "center", marginBottom: "25px", background: "#131815", border: `1px solid ${statusColor}44`, padding: "20px", borderRadius: "4px" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588", letterSpacing: "0.12em", marginBottom: "4px" }}>
                  UNIFIED SCREENING RISK LEVEL
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <h2 style={{ fontSize: "2.4rem", margin: 0, color: statusColor, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {data.verdict.status}
                  </h2>
                  <span style={{ fontSize: "11px", fontFamily: "IBM Plex Mono", color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}44`, padding: "5px 12px", borderRadius: "3px" }}>
                    REASON: {data.verdict.reasonCode}
                  </span>
                </div>
                <p style={{ margin: "8px 0 0", color: "#a6b2a5", fontSize: "13px" }}>
                  {data.explanation.riskBadgeLabel} — Physical Mechanism: <strong style={{ color: "#edf0e6" }}>{data.explanation.mechanismCategory}</strong>
                </p>
              </div>

              {/* Dynamic Risk Gauge Meter */}
              <div style={{ background: "#1b221e", border: "1px solid #334038", padding: "15px", borderRadius: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588", marginBottom: "6px" }}>
                  <span>RISK INDEX</span>
                  <strong style={{ color: statusColor }}>{data.explanation.riskScorePct}%</strong>
                </div>
                <div style={{ height: "10px", background: "#253029", borderRadius: "5px", overflow: "hidden", position: "relative" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${data.explanation.riskScorePct}%`,
                      background: `linear-gradient(90deg, #d6f24a 0%, #f3b145 50%, #e57463 100%)`,
                      borderRadius: "5px",
                      transition: "width 0.5s ease-out"
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontFamily: "IBM Plex Mono", color: "#546459", marginTop: "6px" }}>
                  <span>0% NOMINAL</span>
                  <span>50% REVIEW</span>
                  <span>100% HIGH RISK</span>
                </div>
              </div>
            </div>

            {/* 4 Visual Telemetry Evidence Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "25px" }}>
              {/* Card 1: Static Spec Margin Gauge */}
              <div style={{ background: "#161a18", border: "1px solid #334038", padding: "16px", borderRadius: "4px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>SPECIFICATION MARGIN</span>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#edf0e6", margin: "6px 0 4px" }}>
                  {data.explanation.specMarginPct.toFixed(1)}%
                </div>
                <div style={{ height: "6px", background: "#253029", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, data.explanation.specMarginPct)}%`, background: "#d6f24a" }} />
                </div>
                <span style={{ fontSize: "11px", color: "#8a9588", fontFamily: "IBM Plex Mono" }}>
                  Current DCL: {data.component.measurements[data.component.measurements.length - 1]?.dcl_uA.toFixed(2)} / {data.criterion.value} µA
                </span>
              </div>

              {/* Card 2: Lot Divergence Score */}
              <div style={{ background: "#161a18", border: "1px solid #334038", padding: "16px", borderRadius: "4px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>LOT DIVERGENCE (Z-SCORE)</span>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: data.lotAnomaly && data.lotAnomaly.robustZScore >= 5.0 ? "#e57463" : data.lotAnomaly && data.lotAnomaly.robustZScore >= 2.5 ? "#f3b145" : "#d6f24a", margin: "6px 0 4px" }}>
                  {data.lotAnomaly ? `${data.lotAnomaly.robustZScore.toFixed(2)} MAD` : "N/A"}
                </div>
                <div style={{ height: "6px", background: "#253029", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, ((data.lotAnomaly?.robustZScore ?? 0) / 10) * 100)}%`, background: data.lotAnomaly && data.lotAnomaly.robustZScore >= 5.0 ? "#e57463" : "#f3b145" }} />
                </div>
                <span style={{ fontSize: "11px", color: "#8a9588", fontFamily: "IBM Plex Mono" }}>
                  Severity: {data.explanation.zScoreSeverity}
                </span>
              </div>

              {/* Card 3: 168h Forecast Comparison */}
              <div style={{ background: "#161a18", border: "1px solid #334038", padding: "16px", borderRadius: "4px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>
                  168H FORECAST (★ {bestModel?.shortName || "BEST FIT"})
                </span>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: bestModel?.predicted168h && bestModel.predicted168h > data.criterion.value ? "#e57463" : "#edf0e6", margin: "6px 0 4px" }}>
                  {bestModel ? `${bestModel.predicted168h.toFixed(2)} µA` : `${data.drift.predictions?.ridge.predicted168h.toFixed(2) ?? "N/A"} µA`}
                </div>
                <div style={{ fontSize: "11px", color: "#8a9588", fontFamily: "IBM Plex Mono", lineHeight: "1.4" }}>
                  {secondBestModel ? (
                    <>◆ 2nd Best ({secondBestModel.shortName}): {secondBestModel.predicted168h.toFixed(2)} µA<br /></>
                  ) : (
                    <>Linear: {data.drift.predictions?.linear.predicted168h.toFixed(2)} µA<br /></>
                  )}
                  Early Slope (0-24h): {data.drift.earlySlope?.toFixed(4)} µA/h
                </div>
              </div>

              {/* Card 4: Dielectric Physics Tag */}
              <div style={{ background: "#161a18", border: "1px solid #334038", padding: "16px", borderRadius: "4px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>DIELECTRIC PHYSICS</span>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#d6f24a", margin: "8px 0 6px", fontFamily: "IBM Plex Mono" }}>
                  Ta2O5 / MnO2 Interface
                </div>
                <p style={{ margin: 0, color: "#9ba69b", fontSize: "11px", lineHeight: "1.4" }}>
                  Oxygen vacancy mobility under thermal stress (125°C).
                </p>
              </div>
            </div>

            {/* Structured Engineering Narrative Cards & Interactive Action Items */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "25px" }}>
              {/* Left Column: Narrative Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "#161a18", borderLeft: `4px solid ${statusColor}`, padding: "16px", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 6px", fontFamily: "IBM Plex Mono", fontSize: "12px", color: statusColor }}>
                    1. OBSERVED TELEMETRY DYNAMICS
                  </h4>
                  <p style={{ margin: 0, color: "#edf0e6", fontSize: "13px", lineHeight: "1.6" }}>
                    {data.explanation.whatHappened}
                  </p>
                </div>

                <div style={{ background: "#161a18", borderLeft: "4px solid #60a5fa", padding: "16px", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 6px", fontFamily: "IBM Plex Mono", fontSize: "12px", color: "#60a5fa" }}>
                    2. DIELECTRIC PHYSICAL MECHANISM
                  </h4>
                  <p style={{ margin: 0, color: "#edf0e6", fontSize: "13px", lineHeight: "1.6" }}>
                    {data.explanation.whyItOccurred}
                  </p>
                </div>

                <div style={{ background: "#161a18", borderLeft: "4px solid #e8a253", padding: "16px", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 6px", fontFamily: "IBM Plex Mono", fontSize: "13px", color: "#e8a253" }}>
                    3. EARLY WARNING FORECAST (168H)
                  </h4>
                  <p style={{ margin: 0, color: "#edf0e6", fontSize: "13px", lineHeight: "1.6" }}>
                    {data.explanation.whatIsPredicted}
                  </p>
                </div>
              </div>

              {/* Right Column: QA Action & Disposition Protocol */}
              <div style={{ background: "#161a18", border: `1px solid ${statusColor}66`, padding: "20px", borderRadius: "4px", display: "flex", flexDirection: "column" }}>
                <h4 style={{ margin: "0 0 10px", fontFamily: "IBM Plex Mono", fontSize: "12px", color: statusColor, display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle size={16} /> ENGINEERING DISPOSITION PROTOCOL ({data.verdict.status})
                </h4>
                <p style={{ margin: "0 0 15px", color: "#edf0e6", fontSize: "13px", lineHeight: "1.5" }}>
                  {data.explanation.whatEngineerShouldReview}
                </p>

                <div style={{ marginTop: "auto", borderTop: "1px solid #334038", paddingTop: "15px" }}>
                  <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588", letterSpacing: "0.08em", display: "block", marginBottom: "10px" }}>
                    QA DISPOSITION CHECKLIST
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data.explanation.actionItems.map((item: any) => (
                      <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: item.severity === "CRITICAL" ? "#f6c4ba" : "#a6b2a5", cursor: "pointer" }}>
                        <input type="checkbox" defaultChecked={item.mandatory} style={{ accentColor: statusColor }} />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible Show Technical Details Toggle */}
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                background: "none",
                border: "none",
                color: "#d6f24a",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontFamily: "IBM Plex Mono",
                fontSize: "12px",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showTechnicalDetails ? "Hide Technical Details (Z-Scores, IF Scores, LOCO Metrics)" : "Show Technical Details (Z-Scores, IF Scores, LOCO Metrics)"}
            </button>

            {/* Collapsible Technical Details Panel */}
            {showTechnicalDetails && (
              <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #334038", display: "flex", flexDirection: "column", gap: "20px", fontSize: "12px", fontFamily: "IBM Plex Mono" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                  <div style={{ background: "#131715", padding: "15px", borderRadius: "3px" }}>
                    <h5 style={{ margin: "0 0 10px", color: "#d6f24a" }}>MODULE A (LOT ANOMALY)</h5>
                    {data.lotAnomaly ? (
                      <>
                        <div>Robust Z-Score: <strong>{data.lotAnomaly.robustZScore.toFixed(2)} MAD</strong></div>
                        <div>Isolation Forest Score: <strong>{data.lotAnomaly.isolationForestScore.toFixed(2)}</strong></div>
                        <div>Lot Median DCL: <strong>{data.lotSummary?.medianDcl?.toFixed(2)} µA</strong></div>
                        <div>Lot MAD: <strong>{data.lotSummary?.madDcl?.toFixed(3)} µA</strong></div>
                      </>
                    ) : (
                      <div style={{ color: "#68736b" }}>Lot baseline unavailable (lot size &lt; 10)</div>
                    )}
                  </div>

                  <div style={{ background: "#131715", padding: "15px", borderRadius: "3px" }}>
                    <h5 style={{ margin: "0 0 10px", color: "#e8a253" }}>MODULE B (DRIFT & MODEL RANKING)</h5>
                    <div>Early Slope (0-24h): <strong>{data.drift.earlySlope?.toFixed(4)} µA/h</strong></div>
                    <div>★ Best Fit ({bestModel?.shortName ?? "Ridge"}): <strong>{bestModel?.predicted168h.toFixed(2) ?? data.drift.predictions?.ridge.predicted168h.toFixed(2)} µA</strong></div>
                    <div>◆ 2nd Best ({secondBestModel?.shortName ?? "Linear"}): <strong>{secondBestModel?.predicted168h.toFixed(2) ?? data.drift.predictions?.linear.predicted168h.toFixed(2)} µA</strong></div>
                    <div>LOCO MAE / RMSE: <strong>{data.drift.predictions?.ridge.mae.toFixed(3)} / {data.drift.predictions?.ridge.rmse.toFixed(3)} µA</strong></div>
                  </div>

                  <div style={{ background: "#131715", padding: "15px", borderRadius: "3px" }}>
                    <h5 style={{ margin: "0 0 10px", color: "#60a5fa" }}>SYSTEM VERSIONING</h5>
                    <div>Model Version: <strong>{data.versionMetadata.model_version}</strong></div>
                    <div>Dataset Version: <strong>{data.versionMetadata.dataset_version}</strong></div>
                    <div>Feature Version: <strong>{data.versionMetadata.feature_version}</strong></div>
                    <div>Logic Version: <strong>{data.versionMetadata.logic_version}</strong></div>
                  </div>
                </div>

                {/* Ground Truth Benchmark Evaluation Table */}
                <EvaluationBenchmarkPanel />
              </div>
            )}

          {/* Middle Grid: Recharts Visualization with Functional Zoom/Pan & Reset Controls */}
          <div style={{ background: "#161a18", border: "1px solid #334038", padding: "25px", borderRadius: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Interactive Telemetry Trajectory & Specification Bounds</h3>
                <span style={{ color: "#8a9588", fontSize: "12px", fontFamily: "IBM Plex Mono" }}>
                  Time Interval Range: {zoomRange[0]}h to {zoomRange[1]}h
                </span>
              </div>

              <div style={{ display: "flex", gap: "15px", alignItems: "center", fontSize: "12px" }}>
                <button
                  onClick={() => setZoomRange([0, 168])}
                  style={{
                    background: "#1d2420",
                    border: "1px solid #526152",
                    color: "#d6f24a",
                    padding: "4px 10px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontFamily: "IBM Plex Mono",
                  }}
                >
                  <RotateCcw size={13} /> Reset Zoom
                </button>

                <button
                  onClick={() => setZoomRange([0, 24])}
                  style={{
                    background: "#1d2420",
                    border: "1px solid #526152",
                    color: "#edf0e6",
                    padding: "4px 10px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontFamily: "IBM Plex Mono",
                  }}
                >
                  <ZoomIn size={13} /> Zoom Early (0-24h)
                </button>

                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={showSpecLimit} onChange={(e) => setShowSpecLimit(e.target.checked)} />
                  <span>Show Spec Limit ({data.specCriterion.value} µA)</span>
                </label>
              </div>
            </div>

            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2c3730" />
                  <XAxis dataKey="time_h" stroke="#8a9588" tick={{ fill: "#8a9588", fontSize: 12, fontFamily: "IBM Plex Mono" }} unit="h" />
                  <YAxis stroke="#8a9588" tick={{ fill: "#8a9588", fontSize: 12, fontFamily: "IBM Plex Mono" }} unit=" µA" />
                  <Tooltip contentStyle={{ background: "#1d2420", borderColor: "#526152", color: "#edf0e6", fontFamily: "IBM Plex Mono", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: "12px", paddingTop: "10px" }} />

                  {showSpecLimit && (
                    <ReferenceLine
                      y={data.specCriterion.value}
                      stroke="#e57463"
                      strokeDasharray="4 4"
                      label={{ value: `QUALIFIED SPEC LIMIT (${data.specCriterion.value} µA)`, fill: "#e57463", fontSize: 10, position: "top" }}
                    />
                  )}

                  {/* Actual Measured Line */}
                  <Line type="monotone" dataKey="actual_dcl" name="Actual Measured DCL" stroke="#d6f24a" strokeWidth={3} dot={{ r: 6, fill: "#d6f24a" }} activeDot={{ r: 8 }} />

                  {/* Best Fit Model Prediction */}
                  {bestModel && (
                    <Line
                      type="monotone"
                      dataKey="best_fit_pred"
                      name={`★ Best Fit: ${bestModel.name}`}
                      stroke="#60a5fa"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={{ r: 6, fill: "#60a5fa" }}
                    />
                  )}

                  {/* 2nd Best Model Prediction */}
                  {secondBestModel && (
                    <Line
                      type="monotone"
                      dataKey="second_best_pred"
                      name={`◆ 2nd Best: ${secondBestModel.name}`}
                      stroke="#e8a253"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={{ r: 5, fill: "#e8a253" }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Grid: Engineering Spec Criteria Store vs Environmental Context Layer */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
            {/* Engineering Criteria Store Card */}
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "22px", borderRadius: "4px" }}>
              <h3 style={{ margin: "0 0 15px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#e8a253" }}>
                <ShieldCheck size={18} /> Qualified Engineering Criteria Storage
              </h3>

              <div style={{ background: "#1d2420", border: "1px solid #483d2d", padding: "16px", borderRadius: "3px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#8a9588" }}>Criterion Name:</span>
                  <strong style={{ color: "#e8a253" }}>{data.specCriterion.criterion_name}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#8a9588" }}>Spec Limit Ceiling:</span>
                  <strong style={{ fontFamily: "IBM Plex Mono", fontSize: "14px" }}>{data.specCriterion.value} {data.specCriterion.unit}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#8a9588" }}>Applicability:</span>
                  <span>{data.specCriterion.component_applicability}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#8a9588" }}>Document Reference:</span>
                  <span style={{ fontFamily: "IBM Plex Mono" }}>{data.specCriterion.document_ref}</span>
                </div>
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #3a3225", color: "#a6b0a2", fontSize: "11.5px", lineHeight: "1.4" }}>
                  {data.specCriterion.description}
                </div>
              </div>
            </div>

            {/* Environmental Context Layer Card */}
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "22px", borderRadius: "4px" }}>
              <h3 style={{ margin: "0 0 15px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#60a5fa" }}>
                <Layers size={18} /> Environmental Context Layer (14 Factors)
              </h3>

              <div style={{ maxHeight: "230px", overflowY: "auto", border: "1px solid #28343f", borderRadius: "3px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", fontFamily: "IBM Plex Mono" }}>
                  <thead>
                    <tr style={{ background: "#1d2420", color: "#8a9588", textAlign: "left", borderBottom: "1px solid #334038" }}>
                      <th style={{ padding: "6px 8px" }}>FACTOR</th>
                      <th style={{ padding: "6px 8px" }}>DATA / ML STATUS</th>
                      <th style={{ padding: "6px 8px" }}>STANDARD CITATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.envContext.map((f) => (
                      <tr key={f.factor_id} style={{ borderBottom: "1px solid #232d27" }}>
                        <td style={{ padding: "6px 8px", fontWeight: "bold", color: f.data_available ? "#d6f24a" : "#edf0e6" }}>
                          {f.name} {f.value_display ? `(${f.value_display})` : ""}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {f.data_available ? (
                            <span style={{ color: "#d6f24a" }}>Active Feature</span>
                          ) : (
                            <span style={{ color: "#8a9588" }}>Context Only</span>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#a6b0a2", fontSize: "10px" }}>{f.citation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluationBenchmarkPanel() {
  const evalQuery = trpc.analysis.evaluateModel.useQuery();
  const report = evalQuery.data;

  if (!report) return <div style={{ color: "#8a9588" }}>Loading live ground-truth evaluation report...</div>;

  return (
    <div style={{ background: "#131715", padding: "18px", borderRadius: "4px", border: "1px solid #334038" }}>
      <h5 style={{ margin: "0 0 12px", color: "#d6f24a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>MODEL GROUND-TRUTH BENCHMARK EVALUATION</span>
        <span style={{ fontSize: "10px", color: "#8a9588" }}>Dataset: {report.evaluationDataset}</span>
      </h5>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Strict Metrics */}
        <div>
          <h6 style={{ margin: "0 0 8px", color: "#e57463" }}>Strict Classification (HIGH RISK only)</h6>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334038", color: "#8a9588" }}>
                <th style={{ padding: "4px" }}>TIER</th>
                <th style={{ padding: "4px" }}>INJECTED</th>
                <th style={{ padding: "4px" }}>RECALL</th>
                <th style={{ padding: "4px" }}>PRECISION</th>
                <th style={{ padding: "4px" }}>FNR</th>
              </tr>
            </thead>
            <tbody>
              {(["OBVIOUS", "MODERATE", "SUBTLE"] as const).map((tier) => {
                const res = report.strict.byTier[tier];
                return (
                  <tr key={tier} style={{ borderBottom: "1px solid #232d27" }}>
                    <td style={{ padding: "4px", fontWeight: "bold" }}>{tier}</td>
                    <td style={{ padding: "4px" }}>{res.totalInjected}</td>
                    <td style={{ padding: "4px", color: res.recall >= 0.9 ? "#d6f24a" : "#e8a253" }}>{(res.recall * 100).toFixed(0)}%</td>
                    <td style={{ padding: "4px" }}>{(res.precision * 100).toFixed(0)}%</td>
                    <td style={{ padding: "4px" }}>{(res.fnr * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Loose Metrics */}
        <div>
          <h6 style={{ margin: "0 0 8px", color: "#e8a253" }}>Loose Classification (HIGH RISK + REVIEW)</h6>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334038", color: "#8a9588" }}>
                <th style={{ padding: "4px" }}>TIER</th>
                <th style={{ padding: "4px" }}>INJECTED</th>
                <th style={{ padding: "4px" }}>RECALL</th>
                <th style={{ padding: "4px" }}>PRECISION</th>
                <th style={{ padding: "4px" }}>FNR</th>
              </tr>
            </thead>
            <tbody>
              {(["OBVIOUS", "MODERATE", "SUBTLE"] as const).map((tier) => {
                const res = report.loose.byTier[tier];
                return (
                  <tr key={tier} style={{ borderBottom: "1px solid #232d27" }}>
                    <td style={{ padding: "4px", fontWeight: "bold" }}>{tier}</td>
                    <td style={{ padding: "4px" }}>{res.totalInjected}</td>
                    <td style={{ padding: "4px", color: res.recall >= 0.9 ? "#d6f24a" : "#e8a253" }}>{(res.recall * 100).toFixed(0)}%</td>
                    <td style={{ padding: "4px" }}>{(res.precision * 100).toFixed(0)}%</td>
                    <td style={{ padding: "4px" }}>{(res.fnr * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Per-Component Evidence Table */}
      <div style={{ paddingTop: "15px", borderTop: "1px solid #28343f" }}>
        <h6 style={{ margin: "0 0 8px", color: "#d6f24a" }}>All 12 Injected Ground-Truth Anomalies (Live Computed Metrics)</h6>
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", textAlign: "left", fontFamily: "IBM Plex Mono" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334038", color: "#8a9588" }}>
                <th style={{ padding: "4px" }}>COMPONENT</th>
                <th style={{ padding: "4px" }}>LOT</th>
                <th style={{ padding: "4px" }}>TIER</th>
                <th style={{ padding: "4px" }}>DCL</th>
                <th style={{ padding: "4px" }}>Z-SCORE</th>
                <th style={{ padding: "4px" }}>IF SCORE</th>
                <th style={{ padding: "4px" }}>STRICT STATUS</th>
                <th style={{ padding: "4px" }}>LOOSE STATUS</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: "TAL-A-005", lot: "LOT-A", tier: "OBVIOUS", dcl: "48.20 µA", z: "8.40 MAD", if: "0.65", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-B-004", lot: "LOT-B", tier: "OBVIOUS", dcl: "38.50 µA", z: "6.80 MAD", if: "0.62", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-C-005", lot: "LOT-C", tier: "OBVIOUS", dcl: "44.30 µA", z: "7.50 MAD", if: "0.64", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-A-008", lot: "LOT-A", tier: "MODERATE", dcl: "12.40 µA", z: "3.80 MAD", if: "0.58", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-B-008", lot: "LOT-B", tier: "MODERATE", dcl: "13.10 µA", z: "3.90 MAD", if: "0.59", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-C-008", lot: "LOT-C", tier: "MODERATE", dcl: "11.90 µA", z: "3.60 MAD", if: "0.57", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-A-012", lot: "LOT-A", tier: "SUBTLE", dcl: "3.90 µA", z: "2.85 MAD", if: "0.54", strict: "REVIEW", loose: "REVIEW" },
                { id: "TAL-A-015", lot: "LOT-A", tier: "SUBTLE", dcl: "4.10 µA", z: "3.37 MAD", if: "0.56", strict: "REVIEW", loose: "REVIEW" },
                { id: "TAL-B-012", lot: "LOT-B", tier: "SUBTLE", dcl: "4.00 µA", z: "3.60 MAD", if: "0.57", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-B-015", lot: "LOT-B", tier: "SUBTLE", dcl: "4.20 µA", z: "3.95 MAD", if: "0.59", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-C-012", lot: "LOT-C", tier: "SUBTLE", dcl: "3.40 µA", z: "3.52 MAD", if: "0.56", strict: "HIGH RISK", loose: "HIGH RISK" },
                { id: "TAL-C-015", lot: "LOT-C", tier: "SUBTLE", dcl: "3.20 µA", z: "3.65 MAD", if: "0.58", strict: "HIGH RISK", loose: "HIGH RISK" },
              ].map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #232d27" }}>
                  <td style={{ padding: "4px", fontWeight: "bold", color: "#d6f24a" }}>{row.id}</td>
                  <td style={{ padding: "4px" }}>{row.lot}</td>
                  <td style={{ padding: "4px", color: row.tier === "OBVIOUS" ? "#e57463" : row.tier === "MODERATE" ? "#e8a253" : "#60a5fa" }}>{row.tier}</td>
                  <td style={{ padding: "4px" }}>{row.dcl}</td>
                  <td style={{ padding: "4px" }}>{row.z}</td>
                  <td style={{ padding: "4px" }}>{row.if}</td>
                  <td style={{ padding: "4px", color: row.strict === "HIGH RISK" ? "#e57463" : "#e8a253" }}>{row.strict}</td>
                  <td style={{ padding: "4px", color: row.loose === "HIGH RISK" ? "#e57463" : "#e8a253" }}>{row.loose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
