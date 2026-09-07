import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Database, Layers, Cpu, ChevronRight } from "lucide-react";

export type DatasetCategory = {
  id: string;
  label: string;
  lotIds: string[];
};

interface DatasetCascadeSelectorProps {
  selectedLotId?: string;
  selectedCompId?: string;
  onSelectLot?: (lotId: string) => void;
  onSelectComponent?: (componentId: string) => void;
  showComponentSelector?: boolean;
}

export default function DatasetCascadeSelector({
  selectedLotId,
  selectedCompId,
  onSelectLot,
  onSelectComponent,
  showComponentSelector = true,
}: DatasetCascadeSelectorProps) {
  const componentsQuery = trpc.analysis.getComponents.useQuery();
  const compList = componentsQuery.data ?? [];

  // Group components by Dataset Category & Lot ID
  const { datasetCategories, lotToCompsMap } = useMemo(() => {
    const categoriesMap = new Map<string, { label: string; lotIds: Set<string> }>();
    const lotMap = new Map<string, typeof compList>();

    // Standard preset categories
    categoriesMap.set("ALL", { label: "All Ingested Datasets", lotIds: new Set() });
    categoriesMap.set("SYNTHETIC", { label: "Synthetic Tantalum DCL Benchmark (LOT-A, LOT-B, LOT-C)", lotIds: new Set() });
    categoriesMap.set("REAL_NASA", { label: "NASA HALT Reliability Real Data (NASA-HALT...)", lotIds: new Set() });
    categoriesMap.set("SPACE_QUAL", { label: "MIL-PRF-55365 Space Qualification (LOT-QUAL-SPACE-01)", lotIds: new Set() });
    categoriesMap.set("CUSTOM", { label: "User Uploaded Custom Datasets", lotIds: new Set() });

    for (const comp of compList) {
      // Map lot to components
      if (!lotMap.has(comp.lot_id)) {
        lotMap.set(comp.lot_id, []);
      }
      lotMap.get(comp.lot_id)!.push(comp);

      // Categorize
      categoriesMap.get("ALL")!.lotIds.add(comp.lot_id);

      if (comp.data_type === "SYNTHETIC" || comp.lot_id.startsWith("LOT-") && !comp.lot_id.includes("QUAL")) {
        categoriesMap.get("SYNTHETIC")!.lotIds.add(comp.lot_id);
      } else if (comp.data_type === "REAL_DERIVED" || comp.lot_id.includes("NASA")) {
        categoriesMap.get("REAL_NASA")!.lotIds.add(comp.lot_id);
      } else if (comp.data_type === "SPACE_QUALIFIED_REAL" || comp.lot_id.includes("QUAL")) {
        categoriesMap.get("SPACE_QUAL")!.lotIds.add(comp.lot_id);
      } else {
        categoriesMap.get("CUSTOM")!.lotIds.add(comp.lot_id);
      }
    }

    const categoriesList = Array.from(categoriesMap.entries())
      .filter(([id, val]) => id === "ALL" || val.lotIds.size > 0)
      .map(([id, val]) => ({
        id,
        label: val.label,
        lotIds: Array.from(val.lotIds),
      }));

    return { datasetCategories: categoriesList, lotToCompsMap: lotMap };
  }, [compList]);

  // Active state
  const [activeDatasetId, setActiveDatasetId] = useState<string>("ALL");
  const [activeLotId, setActiveLotId] = useState<string>(selectedLotId || "");
  const [activeCompId, setActiveCompId] = useState<string>(selectedCompId || "");

  // Update active lot when prop changes
  useEffect(() => {
    if (selectedLotId && selectedLotId !== activeLotId) {
      setActiveLotId(selectedLotId);
    }
  }, [selectedLotId]);

  // Update active component when prop changes
  useEffect(() => {
    if (selectedCompId && selectedCompId !== activeCompId) {
      setActiveCompId(selectedCompId);
    }
  }, [selectedCompId]);

  // Filter lots based on selected dataset category
  const filteredLots = useMemo(() => {
    if (activeDatasetId === "ALL") {
      return Array.from(lotToCompsMap.keys());
    }
    const cat = datasetCategories.find((c) => c.id === activeDatasetId);
    return cat ? cat.lotIds : Array.from(lotToCompsMap.keys());
  }, [activeDatasetId, datasetCategories, lotToCompsMap]);

  // Ensure active lot is valid for filtered lots
  useEffect(() => {
    if (filteredLots.length > 0 && !filteredLots.includes(activeLotId)) {
      const defaultLot = filteredLots[0];
      setActiveLotId(defaultLot);
      if (onSelectLot) onSelectLot(defaultLot);
    }
  }, [filteredLots]);

  // Filter components based on active lot
  const filteredComponents = useMemo(() => {
    return lotToCompsMap.get(activeLotId) ?? [];
  }, [activeLotId, lotToCompsMap]);

  // Ensure active component is valid for filtered components
  useEffect(() => {
    if (filteredComponents.length > 0 && !filteredComponents.some((c) => c.component_id === activeCompId)) {
      const defaultComp = filteredComponents[0].component_id;
      setActiveCompId(defaultComp);
      if (onSelectComponent) onSelectComponent(defaultComp);
    }
  }, [filteredComponents]);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #161a18 0%, #111412 100%)",
        border: "1px solid #334038",
        borderRadius: "6px",
        padding: "18px 22px",
        marginBottom: "25px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "14px",
          borderBottom: "1px solid #232d27",
          paddingBottom: "10px",
        }}
      >
        <Database size={15} style={{ color: "#d6f24a" }} />
        <span
          style={{
            fontFamily: "IBM Plex Mono",
            fontSize: "11px",
            letterSpacing: "0.1em",
            color: "#d6f24a",
            fontWeight: 600,
          }}
        >
          HIERARCHICAL DATASET & COMPONENT SELECTOR
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono", fontSize: "10px", color: "#68736b" }}>
          TIER 1: DATASET → TIER 2: LOT → TIER 3: COMPONENT
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: showComponentSelector ? "1.2fr 1fr 1fr" : "1fr 1fr",
          gap: "15px",
          alignItems: "center",
        }}
      >
        {/* Tier 1: Dataset Category */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "IBM Plex Mono",
              fontSize: "10px",
              color: "#8a9588",
              marginBottom: "6px",
              letterSpacing: "0.05em",
            }}
          >
            <Database size={12} style={{ color: "#8a9588" }} /> 1. DATASET SOURCE / REPOSITORY
          </label>
          <select
            value={activeDatasetId}
            onChange={(e) => setActiveDatasetId(e.target.value)}
            style={{
              width: "100%",
              background: "#1c231f",
              color: "#edf0e6",
              border: "1px solid #3d4d42",
              padding: "9px 12px",
              borderRadius: "4px",
              fontFamily: "IBM Plex Mono",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {datasetCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 2: Lot Selection */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "IBM Plex Mono",
              fontSize: "10px",
              color: "#8a9588",
              marginBottom: "6px",
              letterSpacing: "0.05em",
            }}
          >
            <Layers size={12} style={{ color: "#8a9588" }} /> 2. MANUFACTURING LOT BATCH
          </label>
          <select
            value={activeLotId}
            onChange={(e) => {
              const newLot = e.target.value;
              setActiveLotId(newLot);
              if (onSelectLot) onSelectLot(newLot);
            }}
            style={{
              width: "100%",
              background: "#1c231f",
              color: "#edf0e6",
              border: "1px solid #3d4d42",
              padding: "9px 12px",
              borderRadius: "4px",
              fontFamily: "IBM Plex Mono",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {filteredLots.map((lotId) => {
              const comps = lotToCompsMap.get(lotId) || [];
              const dataType = comps[0]?.data_type ?? "";
              return (
                <option key={lotId} value={lotId}>
                  {lotId} ({comps.length} units — {dataType})
                </option>
              );
            })}
          </select>
        </div>

        {/* Tier 3: Component Selection */}
        {showComponentSelector && (
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "IBM Plex Mono",
                fontSize: "10px",
                color: "#8a9588",
                marginBottom: "6px",
                letterSpacing: "0.05em",
              }}
            >
              <Cpu size={12} style={{ color: "#8a9588" }} /> 3. COMPONENT SERIAL NO. (VALUE @ 24H)
            </label>
            <select
              value={activeCompId}
              onChange={(e) => {
                const newComp = e.target.value;
                setActiveCompId(newComp);
                if (onSelectComponent) onSelectComponent(newComp);
              }}
              style={{
                width: "100%",
                background: "#1c231f",
                color: "#edf0e6",
                border: "1px solid #3d4d42",
                padding: "9px 12px",
                borderRadius: "4px",
                fontFamily: "IBM Plex Mono",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {filteredComponents.map((comp) => {
                const m24 = comp.measurements.find((m) => m.time_h === 24) || comp.measurements[0];
                const paramName = m24?.parameter || comp.available_parameters?.[0] || "DCL";
                const unitName = m24?.unit || "µA";
                const val24 = m24?.dcl_uA ?? 0;
                return (
                  <option key={comp.component_id} value={comp.component_id}>
                    {comp.component_id} ({paramName}: {val24.toFixed(2)} {unitName} @ {m24?.time_h ?? 0}h)
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
