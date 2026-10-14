import type { CoverageGap } from './hd-coverage.types.ts'

// The racers the layer has no path for yet, pinned so the list can only shrink. A place's finding that matches a gap does not fail
// the trace; a gap that is no longer found does (remove it). The full-screen cinemas' own cars and figures are drawn by the layer
// since 2026-10 (`cinema-racers`): none is left.
export const KNOWN_COVERAGE_GAPS: readonly CoverageGap[] = []
