import { RacerPartKind } from './hd-coverage.types.ts'
import type { CoverageGap } from './hd-coverage.types.ts'

// The racers the layer has no path for yet, pinned so the list can only shrink: the full-screen cinemas (awards, won cars, circuit
// introductions) draw their worlds' own copies of the champions' cars (in a frame and scale of their own: `VV_CAR.GDB` is the race's
// `VVCM` and `VVJMW` at 1/64, centred on the body; `CR_CAR.GDB` lies along y) and figures (skeletons of their own, bones named per
// file), not the race's models, and no hook is asked for them. A place's finding that matches a gap does not fail the trace; a gap
// that is no longer found does (remove it).
export const KNOWN_COVERAGE_GAPS: readonly CoverageGap[] = [
  { place: 'Circuit 1 introduction cinema', kind: RacerPartKind.BODY, key: 'CRCM' },
  { place: 'Circuit 1 introduction cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Circuit 2 introduction cinema', kind: RacerPartKind.DRIVER, key: 'DUMMY01' },
  { place: 'Circuit 2 introduction cinema', kind: RacerPartKind.BODY, key: 'KKCM' },
  { place: 'Circuit 3 introduction cinema', kind: RacerPartKind.BODY, key: 'BBCM' },
  { place: 'Circuit 3 introduction cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Circuit 4 introduction cinema', kind: RacerPartKind.BODY, key: 'JTCM' },
  { place: 'Circuit 4 introduction cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Circuit 5 introduction cinema', kind: RacerPartKind.BODY, key: 'BVBCM' },
  { place: 'Circuit 5 introduction cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Circuit 7 introduction cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Circuit 7 introduction cinema', kind: RacerPartKind.DRIVER, key: 'VV' },
  { place: 'Circuit 7 introduction cinema', kind: RacerPartKind.DRIVER, key: 'RR1' },
  { place: 'First place award cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Second place award cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Third place award cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Lost circuit cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Winning car cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Rocket Racer car won cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Rocket Racer car won cinema', kind: RacerPartKind.DRIVER, key: 'RRDUM' },
  { place: 'Veronica Voltage car won cinema', kind: RacerPartKind.DRIVER, key: 'GUY1' },
  { place: 'Veronica Voltage car won cinema', kind: RacerPartKind.BODY, key: 'VVCM' },
]
