import { formatDivergence } from '../../../golden-trace/index.ts'
import type { ReplayReport } from '../run-replay/run-replay.types.ts'

const getOriginalOutcome = (report: ReplayReport): string => {
  const { original } = report
  if (original === null) return `the original was not run: ${report.originalSkipReason ?? ''}`
  return original.firstDivergence === null
    ? 'no divergence'
    : `first divergence ${formatDivergence(original.firstDivergence)}`
}

const getFeedSummary = (report: ReplayReport): string => {
  const { original } = report
  if (original === null) return ''
  const stopped =
    original.stopReason === null
      ? 'every frame fed'
      : `emulator side stopped early: ${original.stopReason}`
  return (
    `${stopped}; ${original.controller} controller, ${String(original.gamepadFrameCount)} gamepad and ` +
    `${String(original.menuKeyFrameCount)} menu-key frames fed; ${original.carNote}`
  )
}

// One line: the frames compared, the first divergence or none, why the emulator side stopped early, and the limits that held.
export const formatReplayReportLine = (name: string, report: ReplayReport): string => {
  const compared = report.original?.comparedFrameCount ?? 0
  return (
    `${name}: ${String(compared)} of ${String(report.frameCount)} frames compared, ${getOriginalOutcome(report)}` +
    (report.original === null ? '' : `; ${getFeedSummary(report)}`)
  )
}
