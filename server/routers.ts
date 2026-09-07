import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { evaluateScreening } from "./screening";
import { datasetStore } from "./data/datasetStore";
import { validateCSVContent } from "./data/csvValidator";
import { analyzeComponentDrift } from "./ml/driftModels";
import { analyzeLotAnomalies } from "./ml/lotAnomaly";
import { evaluateUnifiedRisk, evaluateMultiParameterRisk, VERSION_METADATA } from "./ml/riskEngine";
import { getEngineeringCriterionForComponent, isValueExceedingSpec } from "./data/engineeringCriteria";
import { getEnvironmentalContextForComponent } from "./data/environmentalContext";
import { generateUnifiedExplanation, generateCompoundMultiParameterNarrative } from "./ml/unifiedExplanation";
import { calculatePearsonCorrelation } from "./ml/correlation";
import { evaluateModuleA } from "./ml/anomalyEvaluation";
import { saveAnalysisRunRecord, listAnalysisHistory, getHistoricalRun, getDatabaseStats } from "./db";

const checkpointSchema = z.object({
  timeH: z.number().int().refine((value) => [0, 24, 96, 168].includes(value), "Unsupported burn-in checkpoint"),
  value: z.number().finite(),
  absoluteLimit: z.number().finite().nullable().optional(),
  measurementUncertainty: z.number().finite().nonnegative().nullable().optional(),
});

const nasaTrainingRowSchema = z.object({
  value0h: z.number().finite(),
  value24h: z.number().finite(),
  value168h: z.number().finite(),
  parameterName: z.string().max(128).optional(),
  unit: z.string().max(32).optional(),
});

const screeningInputSchema = z.object({
  componentId: z.string().min(1).max(128),
  lotId: z.string().min(1).max(128),
  partNumber: z.string().min(1).max(128),
  parameterName: z.string().min(1).max(128),
  unit: z.string().min(1).max(32),
  checkpoints: z.array(checkpointSchema).min(2),
  peerValuesAt24h: z.array(z.number().finite()).min(3),
  safetySlope: z.number().finite(),
  holdRobustZ: z.number().finite().positive().optional(),
  nasaTrainingData: z.array(nasaTrainingRowSchema).max(10000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  screening: router({
    evaluate: publicProcedure.input(screeningInputSchema).mutation(({ input }) => evaluateScreening(input)),
    recentRuns: publicProcedure.query(() => listAnalysisHistory(25)),
    run: publicProcedure.input(z.object({ runKey: z.string().min(1) })).query(({ input }) => getHistoricalRun(input.runKey)),
  }),
  analysis: router({
    getComponents: publicProcedure.query(() => {
      return datasetStore.getComponentList();
    }),
    getComponent: publicProcedure.input(z.object({ componentId: z.string().min(1) })).query(({ input }) => {
      return datasetStore.getComponent(input.componentId);
    }),
    getLots: publicProcedure.query(() => {
      return datasetStore.getLotList();
    }),
    getDatabaseStats: publicProcedure.query(() => {
      return getDatabaseStats();
    }),
    analyzeDrift: publicProcedure.input(z.object({ componentId: z.string().min(1), parameter: z.string().optional() })).query(({ input }) => {
      return analyzeComponentDrift(input.componentId, input.parameter);
    }),
    analyzeLot: publicProcedure.input(z.object({ lotId: z.string().min(1), parameter: z.string().optional() })).query(({ input }) => {
      return analyzeLotAnomalies(input.lotId, input.parameter);
    }),
    evaluateModel: publicProcedure.query(() => {
      return evaluateModuleA();
    }),
    getParameterCorrelation: publicProcedure.input(z.object({
      lotId: z.string().min(1),
      param1: z.string().min(1),
      param2: z.string().min(1),
    })).query(({ input }) => {
      const pairs = datasetStore.getPairedMeasurements(input.lotId, input.param1, input.param2);
      return calculatePearsonCorrelation(input.param1, input.param2, pairs);
    }),
    getAnalysisHistory: publicProcedure.input(z.object({ limit: z.number().int().positive().optional().default(50) })).query(({ input }) => {
      return listAnalysisHistory(input.limit);
    }),
    getHistoricalRun: publicProcedure.input(z.object({ runKeyOrId: z.string().min(1) })).query(({ input }) => {
      return getHistoricalRun(input.runKeyOrId);
    }),
    unifiedAnalysis: publicProcedure.input(z.object({
      componentId: z.string().min(1),
      parameter: z.string().optional().default("ALL"),
    })).query(({ input }) => {
      const comp = datasetStore.getComponent(input.componentId);
      if (!comp) throw new Error(`Component ${input.componentId} not found`);

      const availableParams = comp.available_parameters || ["DCL"];
      const isAll = !input.parameter || input.parameter === "ALL";
      const targetParams = isAll ? availableParams : [input.parameter];

      // Primary selected parameter for focused display
      const primaryParam = targetParams[0] || "DCL";
      const drift = analyzeComponentDrift(input.componentId, primaryParam);
      const specCriterion = getEngineeringCriterionForComponent(comp.capacitance_uF, comp.rated_voltage_V, comp.component_type, primaryParam);
      const envContext = getEnvironmentalContextForComponent(comp.test_temperature_C, comp.test_voltage_V, comp.available_checkpoints[comp.available_checkpoints.length - 1]);

      let moduleAResult: ReturnType<typeof analyzeLotAnomalies> | null = null;
      let lotCompAnomaly: any = null;

      try {
        moduleAResult = analyzeLotAnomalies(comp.lot_id, primaryParam);
        if (moduleAResult.sufficient) {
          lotCompAnomaly = moduleAResult.components.find((c) => c.componentId === input.componentId);
        }
      } catch (e) {
        // Lot anomaly fallback if insufficient N
      }

      const paramMeas = comp.measurements.filter(m => (m.parameter || "DCL") === primaryParam);
      const currentVal = paramMeas[paramMeas.length - 1]?.dcl_uA ?? 0;

      // Evaluate Single Verdict for Primary Parameter
      const singleVerdict = evaluateUnifiedRisk({
        measuredValue: currentVal,
        specLimit: specCriterion.value,
        minValue: specCriterion.minValue,
        maxValue: specCriterion.maxValue,
        isTwoSided: specCriterion.isTwoSided,
        parameterName: primaryParam,
        unit: specCriterion.unit,
        robustZScore: lotCompAnomaly?.robustZScore,
        isolationForestScore: lotCompAnomaly?.isolationForestScore,
        earlySlope: drift.earlySlope,
        predicted168h: drift.predictions?.ridge.predicted168h ?? drift.predictions?.linear.predicted168h,
        forecastSupported: drift.driftSupported,
      });

      const explanation = generateUnifiedExplanation({
        componentId: comp.component_id,
        lotId: comp.lot_id,
        currentValue: currentVal,
        latestTimeH: comp.available_checkpoints[comp.available_checkpoints.length - 1] ?? 168,
        valChange: drift.valChange ?? 0,
        pctChange: drift.pctChange ?? 0,
        earlySlope: drift.earlySlope ?? 0,
        lotMedianVal: lotCompAnomaly?.lotMedianVal,
        lotMadVal: lotCompAnomaly?.lotMadVal,
        robustZScore: lotCompAnomaly?.robustZScore,
        isolationForestScore: lotCompAnomaly?.isolationForestScore,
        predicted168hLinear: drift.predictions?.linear.predicted168h,
        predicted168hRidge: drift.predictions?.ridge.predicted168h,
        ridgeMae: drift.predictions?.ridge.mae,
        specCriterion,
        verdict: singleVerdict,
        forecastSupported: drift.driftSupported,
      });

      // Multi-Parameter Compound Evaluation
      const allParamVerdicts: Array<{ parameter: string; verdict: typeof singleVerdict; spec: typeof specCriterion; currentVal: number }> = [];
      for (const p of availableParams) {
        const pDrift = analyzeComponentDrift(input.componentId, p);
        const pSpec = getEngineeringCriterionForComponent(comp.capacitance_uF, comp.rated_voltage_V, comp.component_type, p);
        let pLotAnomaly: any = null;
        try {
          const pLotRes = analyzeLotAnomalies(comp.lot_id, p);
          if (pLotRes.sufficient) {
            pLotAnomaly = pLotRes.components.find((c) => c.componentId === input.componentId);
          }
        } catch {}

        const pMeas = comp.measurements.filter(m => (m.parameter || "DCL") === p);
        const pVal = pMeas[pMeas.length - 1]?.dcl_uA ?? 0;

        const pVerdict = evaluateUnifiedRisk({
          measuredValue: pVal,
          specLimit: pSpec.value,
          minValue: pSpec.minValue,
          maxValue: pSpec.maxValue,
          isTwoSided: pSpec.isTwoSided,
          parameterName: p,
          unit: pSpec.unit,
          robustZScore: pLotAnomaly?.robustZScore,
          isolationForestScore: pLotAnomaly?.isolationForestScore,
          earlySlope: pDrift.earlySlope,
          predicted168h: pDrift.predictions?.ridge.predicted168h ?? pDrift.predictions?.linear.predicted168h,
          forecastSupported: pDrift.driftSupported,
        });

        allParamVerdicts.push({ parameter: p, verdict: pVerdict, spec: pSpec, currentVal: pVal });
      }

      const compoundVerdict = evaluateMultiParameterRisk(allParamVerdicts.map(v => v.verdict));
      const compoundNarrative = generateCompoundMultiParameterNarrative(comp.component_id, comp.lot_id, compoundVerdict);

      // Parameter Correlations within Lot
      const correlations: ReturnType<typeof calculatePearsonCorrelation>[] = [];
      if (availableParams.length >= 2) {
        for (let i = 0; i < availableParams.length; i++) {
          for (let j = i + 1; j < availableParams.length; j++) {
            const p1 = availableParams[i];
            const p2 = availableParams[j];
            const pairs = datasetStore.getPairedMeasurements(comp.lot_id, p1, p2);
            correlations.push(calculatePearsonCorrelation(p1, p2, pairs));
          }
        }
      }

      // Persist analysis run record into SQLite
      const runKey = `RUN-${Date.now()}-${comp.component_id}-${primaryParam}`;
      try {
        saveAnalysisRunRecord({
          runKey,
          componentId: comp.component_id,
          lotId: comp.lot_id,
          parameter: isAll ? "ALL_PARAMETERS" : primaryParam,
          decision: compoundVerdict.overallStatus,
          robustZ: lotCompAnomaly?.robustZScore,
          ifScore: lotCompAnomaly?.isolationForestScore,
          predicted168h: drift.predictions?.ridge.predicted168h,
          specLimit: specCriterion.value,
          specLimitExceeded: singleVerdict.specLimitExceeded,
          reasonCode: singleVerdict.reasonCode,
          explanation: isAll ? compoundNarrative.executiveSummary : explanation.whatHappened,
          modelVersion: VERSION_METADATA.model_version,
        });
      } catch (err) {
        console.warn("[AnalysisRouter] Could not save analysis run to history:", err);
      }

      return {
        component: comp,
        selectedParameter: isAll ? "ALL" : primaryParam,
        availableParameters: availableParams,
        drift,
        lotAnomaly: lotCompAnomaly,
        lotSummary: moduleAResult ? {
          totalComponents: moduleAResult.totalComponentsInLot,
          flaggedCount: moduleAResult.flaggedCount,
          medianVal: moduleAResult.lotBaseline?.medianVal,
          madVal: moduleAResult.lotBaseline?.madVal,
        } : null,
        specCriterion,
        criterion: specCriterion,
        envContext,
        verdict: singleVerdict,
        compoundVerdict,
        compoundNarrative,
        allParamVerdicts,
        correlations,
        explanation,
        runKey,
        versionMetadata: VERSION_METADATA,
        timestamp: new Date().toISOString(),
      };
    }),
    uploadCSV: publicProcedure.input(z.object({ csvText: z.string() })).mutation(({ input }) => {
      const res = validateCSVContent(input.csvText);
      if (!res.valid) {
        return { success: false, validation: res };
      }
      datasetStore.addRows(res.rows);
      return { success: true, validation: res };
    }),
    addComponent: publicProcedure.input(z.object({
      component_id: z.string().min(1),
      lot_id: z.string().min(1),
      component_type: z.string().default("Solid MnO2 Tantalum Capacitor"),
      capacitance_uF: z.number().positive().optional(),
      rated_voltage_V: z.number().positive().optional(),
      test_voltage_V: z.number().positive().optional(),
      test_temperature_C: z.number().optional(),
      parameter: z.string().default("DCL"),
      unit: z.string().default("µA"),
      measurements: z.array(z.object({
        time_h: z.number().nonnegative(),
        value: z.number().nonnegative(),
        dcl_uA: z.number().nonnegative().optional(),
      })).min(2),
      data_source: z.string().default("MANUAL_INGESTION"),
      data_type: z.string().default("MANUAL_ENTRY"),
    })).mutation(({ input }) => {
      const rows = input.measurements.map(m => ({
        component_id: input.component_id,
        lot_id: input.lot_id,
        component_type: input.component_type,
        capacitance_uF: input.capacitance_uF,
        rated_voltage_V: input.rated_voltage_V,
        test_voltage_V: input.test_voltage_V,
        test_temperature_C: input.test_temperature_C,
        time_h: m.time_h,
        parameter: input.parameter,
        value: m.value ?? m.dcl_uA ?? 0,
        unit: input.unit,
        dcl_uA: m.value ?? m.dcl_uA ?? 0,
        data_source: input.data_source,
        data_type: input.data_type,
      }));
      datasetStore.addRows(rows);
      return { success: true, component_id: input.component_id };
    }),
  }),
});

export type AppRouter = typeof appRouter;
