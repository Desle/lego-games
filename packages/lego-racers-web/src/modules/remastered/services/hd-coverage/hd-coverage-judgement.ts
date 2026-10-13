import { CoverageOrigin, FallbackReason, RacerPartKind } from './hd-coverage.types.ts'
import type {
  CensusSighting,
  CoverageGap,
  FallbackReason as FallbackReasonValue,
  HdCoverageFinding,
  HdCoveragePlaceResult,
  HookCall,
  ModelFolderIndex,
  RacerPartIdentity,
} from './hd-coverage.types.ts'
import { BUILT_CAR_KEY, getMatchingCalls } from './racer-part-classification.ts'

// Whether the folder has what the layer needs for a part nobody asked about: a champion's car file, any chassis recipe for a
// built car (its chassis is not known without the call); a driver is always a minifigure of the library. The viewer asks for the
// particles of every material of a race when it loads, so a particle material nobody asked about is a path that skips the hook.
const getIsModelPresentWithoutCall = (
  identity: RacerPartIdentity,
  index: ModelFolderIndex
): boolean => {
  if (identity.kind === RacerPartKind.DRIVER || identity.kind === RacerPartKind.PARTICLE)
    return true
  if (identity.key === BUILT_CAR_KEY) return index.chassis.length > 0
  return index.cars.includes(identity.key)
}

const getCallReason = (
  identity: RacerPartIdentity,
  calls: readonly HookCall[],
  index: ModelFolderIndex
): FallbackReasonValue => {
  if (calls.length === 0) {
    return getIsModelPresentWithoutCall(identity, index)
      ? FallbackReason.HOOK_NOT_CALLED
      : FallbackReason.NO_MODEL_FILE
  }
  if (calls.some((call) => call.isFailed)) return FallbackReason.DRAWING_FAILED
  if (calls.some((call) => call.isDrawingReturned)) return FallbackReason.DRAWING_NOT_SHOWN
  return calls.some((call) => call.isModelPresent)
    ? FallbackReason.NO_DRAWING
    : FallbackReason.NO_MODEL_FILE
}

// Wheels belong to their car: they count against the layer only when it drew that car and the original's wheels still showed.
const getWheelsReason = (calls: readonly HookCall[]): FallbackReasonValue | null =>
  calls.some((call) => call.isDrawingReturned && !call.isFailed)
    ? FallbackReason.DRAWING_NOT_SHOWN
    : null

const getSightingKey = (sighting: CensusSighting): string => `${sighting.kind}/${sighting.key}`

const getIsGapOf = (gap: CoverageGap, place: string, identity: RacerPartIdentity): boolean =>
  gap.place === place && gap.kind === identity.kind && gap.key === identity.key

// Every racer part the original drew in a place, once, with the reason; a fallback unless the models folder has nothing for it.
export const getPlaceFindings = (
  result: HdCoveragePlaceResult,
  gaps: readonly CoverageGap[]
): readonly HdCoverageFinding[] => {
  const originals = new Map(
    result.sightings
      .filter((sighting) => sighting.origin === CoverageOrigin.ORIGINAL)
      .map((sighting) => [getSightingKey(sighting), sighting] as const)
  )
  return [...originals.values()].flatMap((sighting): readonly HdCoverageFinding[] => {
    const calls = getMatchingCalls(sighting, result.calls)
    const reason =
      sighting.kind === RacerPartKind.WHEELS
        ? getWheelsReason(calls)
        : getCallReason(sighting, calls, result.modelIndex)
    if (reason === null) return []
    return [
      {
        place: result.name,
        kind: sighting.kind,
        key: sighting.key,
        reason,
        isFallback: reason !== FallbackReason.NO_MODEL_FILE,
        isKnownGap: gaps.some((gap) => getIsGapOf(gap, result.name, sighting)),
      },
    ]
  })
}

// The parts the layer drew in a place, by kind and key, for the report.
export const getLayerDrawnKeys = (result: HdCoveragePlaceResult): readonly string[] => [
  ...new Set(
    result.sightings
      .filter((sighting) => sighting.origin === CoverageOrigin.LAYER)
      .map(getSightingKey)
  ),
]

// A fallback the layer should have drawn: the trace fails on it.
export const getIsFailure = (finding: HdCoverageFinding): boolean =>
  finding.isFallback && !finding.isKnownGap

const getFindingLabel = (finding: HdCoverageFinding): string => {
  if (finding.isKnownGap) return 'gap '
  return finding.isFallback ? 'FAIL' : 'ok  '
}

export const formatFinding = (finding: HdCoverageFinding): string =>
  `${getFindingLabel(finding)} ${finding.place}: ${finding.kind} ${finding.key} drawn by the original (${finding.reason})`

// The gaps of a place that its findings no longer show: the layer draws them now, so they leave the list.
export const getStaleGaps = (
  place: string,
  findings: readonly HdCoverageFinding[],
  gaps: readonly CoverageGap[]
): readonly CoverageGap[] =>
  gaps.filter(
    (gap) =>
      gap.place === place &&
      !findings.some((finding) => finding.isKnownGap && getIsGapOf(gap, place, finding))
  )
