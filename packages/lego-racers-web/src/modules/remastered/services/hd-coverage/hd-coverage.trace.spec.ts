import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getChromePath, startTracePage } from '../../../../shared/trace-browser/trace-browser.ts'
import type { TracePage } from '../../../../shared/trace-browser/trace-browser.types.ts'
import type {
  HdCoverageFinding,
  HdCoveragePlace,
  HdCoveragePlaceResult,
  HdCoverageWindow,
} from './hd-coverage.types.ts'
import { KNOWN_COVERAGE_GAPS } from './hd-coverage-gaps.ts'
import {
  formatFinding,
  getIsFailure,
  getLayerDrawnKeys,
  getPlaceFindings,
  getStaleGaps,
} from './hd-coverage-judgement.ts'
import { HD_COVERAGE_PLACES } from './hd-coverage-places.ts'
import {
  formatOnScreenDrawing,
  getOnScreenFailures,
  getPowerUpOnScreenFailures,
} from './on-screen-judgement.ts'
import {
  formatDriverSeat,
  getDriverSeatFailures,
  getSteeringWheelNotes,
} from './driver-seat-judgement.ts'

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../../../../..')
const REPOSITORY_DIRECTORY = resolve(PACKAGE_DIRECTORY, '../..')
const OUTPUT_DIRECTORY = join(PACKAGE_DIRECTORY, '.hd-coverage')

const environment = process.env
const jamPath =
  environment['LEGO_JAM_PATH'] ??
  join(REPOSITORY_DIRECTORY, 'original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM')
const ldrawRoot = environment['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const modelsRoot = environment['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')
const chromePath = getChromePath()
const SELECTED_PLACES = (environment['HD_COVERAGE_PLACES'] ?? '')
  .split(',')
  .filter((name) => name !== '')
const isAvailable =
  existsSync(jamPath) &&
  existsSync(join(ldrawRoot, 'LDConfig.ldr')) &&
  existsSync(modelsRoot) &&
  chromePath !== null

const places = HD_COVERAGE_PLACES.filter(
  (place) =>
    SELECTED_PLACES.length === 0 ||
    SELECTED_PLACES.some((name) => place.name.toLowerCase().includes(name.toLowerCase()))
)

// Drives the remastered layer (`?hd`) through every place the game draws a racer and fails when the original draws a car or a
// driver that the models folder has a model for. The folder is a scratch copy, so nothing the layer does can touch the real one.
// `HD_COVERAGE_PLACES=garage,time trial` limits the run; docs: remastered.md.
describe.skipIf(!isAvailable)('HD coverage', () => {
  let tracePage: TracePage | null = null
  let scratchModels: string | null = null
  const results: HdCoveragePlaceResult[] = []
  beforeAll(async () => {
    if (chromePath === null) return
    scratchModels = mkdtempSync(join(tmpdir(), 'hd-coverage-models-'))
    cpSync(modelsRoot, scratchModels, { recursive: true })
    environment['LEGO_LDRAW_MODELS_ROOT'] = scratchModels
    tracePage = await startTracePage({
      chromePath,
      pagePath: '/?hd&hd-coverage',
      readyFunctionName: 'runHdCoveragePlace',
      port: 5420,
      label: 'hd coverage',
    })
  })
  afterAll(async () => {
    await tracePage?.close()
    if (scratchModels !== null) rmSync(scratchModels, { recursive: true, force: true })
    environment['LEGO_LDRAW_MODELS_ROOT'] = modelsRoot
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
    writeFileSync(join(OUTPUT_DIRECTORY, 'results.json'), JSON.stringify(results, null, 1))
  })

  it.each(places)('draws every modelled racer of $name from the layer', async (place) => {
    // Arrange
    if (tracePage === null) throw new Error('No browser')
    const { page } = tracePage

    // Act
    const result = await page.evaluate<HdCoveragePlaceResult, HdCoveragePlace>(
      (given) => (window as unknown as HdCoverageWindow).runHdCoveragePlace(given),
      place
    )
    results.push(result)
    const findings: readonly HdCoverageFinding[] = getPlaceFindings(result, KNOWN_COVERAGE_GAPS)
    const onScreenFailures = [
      ...getOnScreenFailures(
        result.onScreenFrames,
        place.kind === 'on_screen' ? place.expectedHooks : []
      ),
      ...(place.kind === 'on_screen' && place.isEveryPowerUpFileShown
        ? getPowerUpOnScreenFailures(result.onScreenFrames, result.calls)
        : []),
    ]

    // Assert
    console.log(
      [
        `${place.name}: ${String(result.renderCount)} renders censused, ${String(result.calls.length)} hook calls`,
        `  layer: ${getLayerDrawnKeys(result).join(', ') || 'nothing'}`,
        ...findings.map((finding) => `  ${formatFinding(finding)}`),
        ...result.partFindings.map(
          (finding) =>
            `  FAIL ${finding.model} line ${String(finding.lineNumber)} (${finding.part}): ${finding.loss}`
        ),
        ...result.driverSeats.map((seat) => `  seat ${formatDriverSeat(seat)}`),
        ...getDriverSeatFailures(result.driverSeats).map((failure) => `  FAIL seat ${failure}`),
        ...getSteeringWheelNotes(result.driverSeats).map((note) => `  note ${note}`),
        ...result.onScreenFrames.flatMap((frame) => [
          `  on screen ${frame.label}: noise ${String(frame.unchangedDifference)} pixels, WebGL errors ${String(frame.webglErrors.length)}`,
          ...frame.drawings.map((drawing) => `    ${formatOnScreenDrawing(frame, drawing)}`),
        ]),
        ...onScreenFailures.map((failure) => `  FAIL on screen ${failure}`),
        ...(result.unsettledCallIds.length === 0
          ? []
          : [`  unsettled drawings: calls ${result.unsettledCallIds.join(', ')}`]),
      ].join('\n')
    )
    expect(
      result.renderCount,
      'Fix: the place drew no 3D scene; correct its keys or screen'
    ).toBeGreaterThan(0)
    expect(
      findings.filter(getIsFailure).map(formatFinding),
      'Fix: ask the layer for this racer where the viewer draws it (racer-drawing, race-viewport), or fix the drawing'
    ).toEqual([])
    expect(
      result.partFindings,
      'Fix: every part line of a model file must be drawn where the file puts it; find where the drawing loses it (racer-model-parts, ldraw-model-merge, the detail switch)'
    ).toEqual([])
    expect(
      getDriverSeatFailures(result.driverSeats),
      'Fix: the LDraw driver must sit where the original seats its driver (the seat point of the racer appearance); find where its pose or figure frame moves it (ldraw-racer-driver, ldraw-driver-drawing, minifig-joints)'
    ).toEqual([])
    expect(
      onScreenFailures,
      "Fix: the layer's drawing is in the scene but not on the screen; find the draw WebGL refuses or the material that draws nothing (its uniforms, textures, shader)"
    ).toEqual([])
    expect(
      getStaleGaps(place.name, findings, KNOWN_COVERAGE_GAPS),
      'Fix: the layer draws these now; remove them from KNOWN_COVERAGE_GAPS (hd-coverage-gaps.ts)'
    ).toEqual([])
  })
})
