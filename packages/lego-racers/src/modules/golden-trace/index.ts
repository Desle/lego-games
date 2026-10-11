export { compareTraces } from './controller/compare-traces/compare-traces.ts'
export { getPortTrace, getTraceFields } from './controller/port-trace/port-trace.ts'
export {
  formatDivergence,
  getPlayerDivergences,
  runGoldenTrace,
} from './controller/run-golden-trace/run-golden-trace.ts'
export type { GoldenTraceResult } from './controller/run-golden-trace/run-golden-trace.ts'
export { getRouteDrivingFrames } from './controller/route-driving/route-driving.ts'
export {
  createTraceScenario,
  getIdleFrames,
  getSteeringSweepFrames,
  getWeavingFrames,
  holdBindings,
} from './controller/trace-scenarios/trace-scenarios.ts'
export {
  getIsOriginalTraceAvailable,
  readOriginalTrace,
} from './services/original-trace/original-trace.ts'
export type {
  FieldDivergence,
  GoldenTraceScenario,
  OriginalTrace,
  TraceComparison,
  TraceFields,
  TraceFrame,
  TraceFrameInput,
} from './types/golden-trace.types.ts'
