import { useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  CircleAlert,
  Menu,
  MoreVertical,
  PlusCircle,
  Radar,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const heroImage = "/manus-storage/burn-in-sentinel-hero_4077833d.png";

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={`brand-mark ${className || ""}`} style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "24px",
      height: "24px",
      background: "linear-gradient(135deg, #1e40af, #3b82f6)",
      borderRadius: "4px",
      border: "1px solid #60a5fa",
      color: "#ffffff"
    }}>
      <Radar size={16} />
    </div>
  );
}

type Status = "ACCEPT" | "HOLD" | "REJECT";

export function selectSampleState(nextStatus: Status) {
  return { status: nextStatus, serverEvidence: null } as const;
}

function SignalStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`signal-strip ${compact ? "signal-strip--compact" : ""}`} aria-hidden="true">
      <span className="signal-strip__line" />
      {["0H", "24H", "96H", "168H"].map((label, index) => (
        <span className="signal-strip__tick" key={label} style={{ left: `${index * 33.33}%` }}>
          <i /> <b>{label}</b>
        </span>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label"><BrandMark className="section-label__mark" />{children}</p>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="site-shell">
      <aside className={`site-rail ${mobileOpen ? "site-rail--open" : ""}`}>
        <button className="rail-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        <div className="brand-block">
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #1d2721 0%, #111512 100%)",
            border: "1px solid #334038",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#d6f24a",
            boxShadow: "0 0 10px rgba(214,242,74,0.15)",
            flexShrink: 0
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="brand-kicker" style={{ color: "#d6f24a", fontSize: "10px", letterSpacing: "0.12em", fontWeight: 600 }}>BS / 01</span>
            <strong style={{ color: "#edf0e6", fontSize: "15px", letterSpacing: "-0.02em" }}>Burn-In Sentinel</strong>
          </div>
        </div>
        <div className="rail-rule" />
        <nav className="rail-nav" aria-label="Primary navigation">
          <button onClick={() => setLocation("/analysis")}><span>01</span>Unified Workbench<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/module-a")}><span>02</span>Analyze Lot (Module A)<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/module-b")}><span>03</span>Analyze Component (Module B)<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/upload")}><span>04</span>Upload Dataset<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/add-component")}><span>05</span>Add Component<ChevronRight size={13} /></button>
        </nav>
        <div className="rail-status"><span className="status-dot" />SYSTEM NOMINAL<span className="rail-status__code">v0.9.4</span></div>
      </aside>

      <main className="site-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <span className="topbar-path" style={{ color: "#8a968c", letterSpacing: "0.12em", fontWeight: 500, fontSize: "10px" }}>RELIABILITY / SCREENING / LIVE PROTOTYPE</span>
          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="live-dot" />
            <span style={{ color: "#d6f24a", fontWeight: 600, fontSize: "10px", letterSpacing: "0.1em" }}>BAY 03</span>
            
            <button
              onClick={() => setLocation("/analysis")}
              style={{
                background: "#d6f24a",
                color: "#111412",
                border: "none",
                fontWeight: 700,
                padding: "8px 16px",
                borderRadius: "4px",
                boxShadow: "0 0 14px rgba(214, 242, 74, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                letterSpacing: "0.08em"
              }}
            >
              WORKBENCH <ArrowRight size={14} />
            </button>
            
            <button
              onClick={() => setLocation("/module-a")}
              style={{
                background: "#161b18",
                border: "1px solid #334038",
                color: "#edf0e6",
                padding: "8px 14px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                letterSpacing: "0.08em"
              }}
            >
              ANALYZE LOT <Radar size={14} />
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More options"
                  style={{
                    background: "#161b18",
                    border: "1px solid #334038",
                    color: "#d6f24a",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ background: "#161a18", border: "1px solid #334038", color: "#edf0e6", padding: "6px", borderRadius: "6px", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
                <DropdownMenuItem onClick={() => setLocation("/module-b")} style={{ cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", fontSize: "13px", color: "#edf0e6" }}>
                  <Activity size={15} style={{ color: "#d6f24a" }} /> Analyze Component (Module B)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/upload")} style={{ cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", fontSize: "13px", color: "#edf0e6" }}>
                  <Upload size={15} style={{ color: "#d6f24a" }} /> Upload Dataset
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/add-component")} style={{ cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", fontSize: "13px", color: "#edf0e6" }}>
                  <PlusCircle size={15} style={{ color: "#d6f24a" }} /> Add Component
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* TOP HERO BENCHMARK & PROBLEM STATEMENT TELEMETRY BANNER */}
        <section id="overview" className="hero-section">
          <div className="hero-image" style={{ backgroundImage: `url(${heroImage})` }} />
          <div className="hero-grid" />
          <div className="hero-copy">
            <SectionLabel>ESS BURN-IN RELIABILITY SCREENING ENGINE</SectionLabel>
            <h1>Catch Latent Defects<br /><em>Before Payload Integration.</em></h1>
            <p className="hero-lede">
              Traditional screening relies on static pass/fail limits (e.g. 50 µA). <strong>Burn-In Sentinel</strong> applies dynamic population anomaly scoring and 0h+24h drift forecasting to catch latent defects at 24h.
            </p>
            <div className="hero-actions">
              <button className="button button--signal" onClick={() => setLocation("/analysis")} style={{ padding: "14px 28px", fontSize: "15px" }}>
                Open Unified QA Console <ShieldCheck size={18} />
              </button>
              <button className="button button--dark" onClick={() => setLocation("/upload")} style={{ width: "auto" }}>
                Upload Telemetry CSV <Upload size={16} />
              </button>
            </div>
          </div>

          <div className="hero-telemetry panel-glass">
            <div className="telemetry-head">
              <span>PROBLEM STATEMENT BENCHMARK</span>
              <span className="telemetry-id">LOT MEDIAN: 10.0 µA</span>
            </div>
            <div className="telemetry-main">
              <strong>45.0</strong>
              <span>µA @ 24H (Spec: 50 µA)</span>
              <span className="warning-chip"><CircleAlert size={13} /> OOF ANOMALY</span>
            </div>
            <div style={{ fontSize: "11px", color: "#8a968c", padding: "0 15px 10px", lineHeight: "1.4", fontFamily: "IBM Plex Mono" }}>
              Part reading 45 µA is an extreme +350% anomaly relative to lot median (10 µA), even though it is below the datasheet ceiling (50 µA).
            </div>
            <SignalStrip compact />
          </div>
        </section>

        {/* PS CORE MODULES DASHBOARD: MODULE A & MODULE B */}
        <section id="detection" className="dark-section section-pad detection-section" style={{ background: "#111512", borderTop: "1px solid #232c26", borderBottom: "1px solid #232c26" }}>
          <div className="section-head">
            <div>
              <SectionLabel>EXPECTED SOLUTION ARCHITECTURE</SectionLabel>
              <h2>Two Predictive Lenses.<br /><em>Zero Latent Defects.</em></h2>
            </div>
            <p>
              Designed strictly around official Problem Statement specifications: Dynamic lot outlier scoring and 24h to 168h time-series drift forecasting for DCL leakage current.
            </p>
          </div>

          <div className="engine-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" }}>
            {/* Module A Dashboard Card */}
            <article className="engine-card engine-card--lime" style={{ background: "#161b18", border: "1px solid #334038", padding: "28px", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#d6f24a", letterSpacing: "0.12em" }}>MODULE A ENGINE</span>
                <Radar size={28} style={{ color: "#d6f24a" }} />
              </div>
              <h3 style={{ fontSize: "20px", color: "#edf0e6", margin: "0 0 10px" }}>Dynamic Outlier Detection System</h3>
              <p style={{ color: "#9ba69b", fontSize: "13px", lineHeight: "1.6", marginBottom: "20px" }}>
                Eliminates static limit blind spots. Uses Median & MAD Robust Z-Scores (Z ≥ 3.0) and Isolation Forest (N_trees = 100) to flag components drifting far above their lot peers at 24h.
              </p>
              <div style={{ background: "#111412", padding: "12px 16px", borderRadius: "4px", border: "1px solid #27332b", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>OUTLIER SCENARIO</span>
                <strong style={{ fontSize: "12px", fontFamily: "IBM Plex Mono", color: "#e57463" }}>45 µA vs 10 µA Lot Median (OOF Flagged)</strong>
              </div>
              <button
                className="button button--dark"
                onClick={() => setLocation("/module-a")}
                style={{ width: "100%", justifyContent: "center", background: "#212a24", border: "1px solid #3d4d42", color: "#d6f24a" }}
              >
                Scan Lots in Module A <ChevronRight size={16} />
              </button>
            </article>

            {/* Module B Dashboard Card */}
            <article className="engine-card engine-card--amber" style={{ background: "#161b18", border: "1px solid #334038", padding: "28px", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#f3b145", letterSpacing: "0.12em" }}>MODULE B ENGINE</span>
                <Activity size={28} style={{ color: "#f3b145" }} />
              </div>
              <h3 style={{ fontSize: "20px", color: "#edf0e6", margin: "0 0 10px" }}>Time-Series Drift Predictor</h3>
              <p style={{ color: "#9ba69b", fontSize: "13px", lineHeight: "1.6", marginBottom: "20px" }}>
                Predictive regression taking 0h and 24h DCL measurements to forecast 168h leakage current. If predicted 168h drift rate breaches the dynamic safety slope, component is rejected early at 24h.
              </p>
              <div style={{ background: "#111412", padding: "12px 16px", borderRadius: "4px", border: "1px solid #27332b", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>FORECAST MODEL</span>
                <strong style={{ fontSize: "12px", fontFamily: "IBM Plex Mono", color: "#f3b145" }}>LOCO Cross-Validated Regression (MAE &lt; 0.06 µA)</strong>
              </div>
              <button
                className="button button--dark"
                onClick={() => setLocation("/module-b")}
                style={{ width: "100%", justifyContent: "center", background: "#212a24", border: "1px solid #3d4d42", color: "#f3b145" }}
              >
                Forecast Drift in Module B <ChevronRight size={16} />
              </button>
            </article>
          </div>
        </section>

        <footer className="footer" style={{ borderTop: "1px solid #232c26", padding: "30px 0" }}>
          <div className="footer-brand">
            <BrandMark />
            <div>
              <strong>Burn-In Sentinel</strong>
              <span>EXPLAINABLE HIGH-RELIABILITY SCREENING</span>
            </div>
          </div>
          <span>Problem Statement Engine / v1.0.0</span>
          <button onClick={() => scrollTo("overview")}>BACK TO TOP ↑</button>
        </footer>
      </main>
    </div>
  );
}
