import { CoverageOrigin, HookKind, RacerPartKind } from './hd-coverage.types.ts'
import type { CensusSighting, HdCoveragePlaceResult, HookCall } from './hd-coverage.types.ts'
import { getIsFailure, getPlaceFindings, getStaleGaps } from './hd-coverage-judgement.ts'

const PLACE = 'Time trial'
const INDEX = { cars: ['VVCM'], chassis: ['crchas0'] }

const getOriginal = (kind: CensusSighting['kind'], key: string): CensusSighting => ({
  origin: CoverageOrigin.ORIGINAL,
  kind,
  key,
  callId: null,
})

const getCarCall = (change: Partial<HookCall>): HookCall => ({
  id: 1,
  hook: HookKind.CAR,
  key: 'VVCM',
  wheelsKey: 'VVJMW',
  isModelPresent: true,
  isDrawingReturned: false,
  isFailed: false,
  ...change,
})

const getResult = (
  sightings: readonly CensusSighting[],
  calls: readonly HookCall[]
): HdCoveragePlaceResult => ({
  name: PLACE,
  calls,
  sightings,
  otherSources: [],
  renderCount: 1,
  modelIndex: INDEX,
  unsettledCallIds: [],
  partFindings: [],
  driverSeats: [],
  onScreenFrames: [],
})

describe('getPlaceFindings', () => {
  it('fails a modelled champion car the hook was never asked for', () => {
    // Arrange
    const result = getResult([getOriginal(RacerPartKind.BODY, 'VVCM')], [])

    // Act
    const findings = getPlaceFindings(result, [])

    // Assert
    expect(findings.map((finding) => [finding.reason, getIsFailure(finding)])).toEqual([
      ['hook_not_called', true],
    ])
  })

  it('lets a car without a model file be drawn by the original', () => {
    // Arrange
    const result = getResult([getOriginal(RacerPartKind.BODY, 'KKCM')], [])

    // Act
    const findings = getPlaceFindings(result, [])

    // Assert
    expect(findings.map((finding) => [finding.reason, getIsFailure(finding)])).toEqual([
      ['no_model_file', false],
    ])
  })

  it('names a failed drawing and one that was made but not shown', () => {
    // Arrange
    const failed = getResult(
      [getOriginal(RacerPartKind.BODY, 'VVCM')],
      [getCarCall({ isDrawingReturned: true, isFailed: true })]
    )
    const hidden = getResult(
      [getOriginal(RacerPartKind.BODY, 'VVCM'), getOriginal(RacerPartKind.WHEELS, 'VVJMW')],
      [getCarCall({ isDrawingReturned: true })]
    )

    // Act
    const reasons = [failed, hidden].map((result) =>
      getPlaceFindings(result, []).map((finding) => finding.reason)
    )

    // Assert
    expect(reasons).toEqual([['drawing_failed'], ['drawing_not_shown', 'drawing_not_shown']])
  })

  it('counts every driver as modelled, and reports nothing the layer drew', () => {
    // Arrange
    const layer: CensusSighting = {
      origin: CoverageOrigin.LAYER,
      kind: RacerPartKind.BODY,
      key: 'VVCM',
      callId: 1,
    }
    const result = getResult(
      [layer, getOriginal(RacerPartKind.DRIVER, 'VVPELVIS')],
      [getCarCall({ isDrawingReturned: true })]
    )

    // Act
    const findings = getPlaceFindings(result, [])

    // Assert
    expect(findings.map((finding) => [finding.kind, finding.reason])).toEqual([
      ['driver', 'hook_not_called'],
    ])
  })

  it('does not fail a known gap, and calls a gap no longer found stale', () => {
    // Arrange
    const gaps = [
      { place: PLACE, kind: RacerPartKind.DRIVER, key: 'GUY1' },
      { place: PLACE, kind: RacerPartKind.BODY, key: 'CRCM' },
    ]
    const result = getResult([getOriginal(RacerPartKind.DRIVER, 'GUY1')], [])

    // Act
    const findings = getPlaceFindings(result, gaps)

    // Assert
    expect(findings.filter(getIsFailure)).toEqual([])
    expect(getStaleGaps(PLACE, findings, gaps)).toEqual([gaps[1]])
  })
})
