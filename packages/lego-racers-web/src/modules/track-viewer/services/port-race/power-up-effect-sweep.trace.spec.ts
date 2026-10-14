import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  matchTextures,
  rasteriseFrame,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import type {
  OriginalPresentation,
  OriginalRenderFrame,
  RasterisedFrame,
} from '@lego-games/lego-racers/presentation-trace'
import type { EffectSweepResult } from '../../../../shared/effect-sweep/effect-sweep.types.ts'
import { getChromePath, startTracePage } from '../../../../shared/trace-browser/trace-browser.ts'
import type { TracePage } from '../../../../shared/trace-browser/trace-browser.types.ts'
import { EFFECT_MODEL_NAMES } from '../../../../shared/viewer-extensions/effect-model-names.ts'
import type { PixelTraceRequest } from '../pixel-trace-harness/pixel-trace-harness.types.ts'
import { loadEffectModel } from '../race-assets/race-assets.ts'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import { CLEAR_COLOR, getPixelTraceRequest } from './pixel-comparison.ts'
import { ORIGINAL_STAGE_SIZE } from './port-race.ts'
import { getSceneTextures, getTexturesOfScenes } from './render-comparison.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import { EFFECT_SWEEP_CASES, getHeldCase } from './power-up-effect-sweep-cases.ts'
import { KNOWN_EFFECT_SWEEP_GAPS } from './power-up-effect-sweep-gaps.ts'
import {
  formatFailure,
  getBoneGroupCount,
  getClassicFailures,
  getDifferingShare,
  getEffectMask,
  getEffectRegions,
  getEffectTextureCoverages,
  getLayerFailures,
  getNewPictureCounts,
  getNewPictureHashes,
  getStaleGaps,
  getUnknownFailures,
  sumTextureCoverages,
} from './power-up-effect-sweep-judgement.ts'
import type {
  EffectRegion,
  EffectSweepFailure,
  EffectSweepMode,
  EffectSweepRun,
  EffectSweepWindow,
  EffectTextureCoverage,
  PowerUpEffectCase,
} from './power-up-effect-sweep.types.ts'

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../../../../..')
const OUTPUT_DIRECTORY = join(PACKAGE_DIRECTORY, '.effect-sweep')
const PERCENT = 100
const TOLERANCE_LEVELS = 32
// Of a piece of the effect the original paints, at most this share of the pixels may differ in the port: a missing hook or beam
// differs almost everywhere, a drawn one in its edges and blending.
const MAXIMUM_DIFFERING_SHARE = 0.5
// The pieces of the effect the report lists, worst first.
const REPORTED_REGION_PIXELS = 10
const REPORTED_REGION_COUNT = 4
// The effect folders the scratch copy without files has emptied: the power-up objects (and the cannon ball) and the particles.
const EFFECT_FOLDERS: readonly string[] = ['powerups', 'particles']
// Copying the models folder and starting a development server and a browser.
const SETUP_TIMEOUT_MILLISECONDS = 600_000
const MODES: readonly EffectSweepMode[] = ['classic', 'hd_empty', 'hd_files']
const MODE_TITLES: Readonly<Record<EffectSweepMode, string>> = Object.freeze({
  classic: 'Classic',
  hd_empty: 'hd, no effect files',
  hd_files: 'hd, with files',
})

const environment = process.env
const ldrawRoot = environment['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const modelsRoot = environment['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')
const chromePath = getChromePath()
const SELECTED_CASES = (environment['EFFECT_SWEEP_CASES'] ?? '')
  .split(',')
  .filter((name) => name !== '')
const isClassicAvailable =
  getIsOriginalGamePresent() && getIsOriginalPresentationAvailable() && chromePath !== null
const isLayerAvailable =
  isClassicAvailable && existsSync(join(ldrawRoot, 'LDConfig.ldr')) && existsSync(modelsRoot)

const cases = EFFECT_SWEEP_CASES.filter(
  (sweepCase) =>
    SELECTED_CASES.length === 0 ||
    SELECTED_CASES.some((name) => sweepCase.name.toLowerCase().includes(name.toLowerCase()))
)

const getRenderFrame = (presentation: OriginalPresentation, frame: number): OriginalRenderFrame => {
  const found = presentation.renderFrames.find((candidate) => candidate.frame === frame)
  if (found === undefined) throw new Error(`The original recorded no frame ${String(frame)}`)
  return found
}

const rasterise = (
  presentation: OriginalPresentation,
  renderFrame: OriginalRenderFrame,
  isHudIncluded: boolean
): RasterisedFrame =>
  rasteriseFrame(renderFrame, presentation.textures, {
    ...ORIGINAL_STAGE_SIZE,
    isHudIncluded,
    clearColor: CLEAR_COLOR,
  })

// The pictures with no name among the port's that the fired race paints more of than the held one, summed over the frames.
const getUnnamedNewPictures = (
  frameCounts: readonly ReadonlyMap<string, number>[],
  labels: ReadonlyMap<string, string>
): readonly string[] => {
  const increases = new Map<string, number>()
  for (const counts of frameCounts) {
    for (const [hash, increase] of counts) {
      if ((labels.get(hash) ?? hash) === hash)
        increases.set(hash, (increases.get(hash) ?? 0) + increase)
    }
  }
  return [...increases].map(([hash, increase]) => `${hash} +${String(increase)}`)
}

const runOnPage = async (
  page: TracePage,
  mode: EffectSweepMode,
  request: PixelTraceRequest
): Promise<EffectSweepRun> => {
  const result = await page.page.evaluate<EffectSweepResult, PixelTraceRequest>(
    (given) => (window as unknown as EffectSweepWindow).runEffectSweep(given),
    request
  )
  return { mode, ...result }
}

// The bone groups of every effect model's mesh: how many posed parts a drawing in its place needs.
const getBoneGroupCounts = (jam: Uint8Array): ReadonlyMap<string, number> => {
  const archive = openJamArchive(jam)
  return new Map(
    EFFECT_MODEL_NAMES.map((name) => {
      const mesh = loadEffectModel(archive, name, false).scene.meshes[0]
      return [name, mesh === undefined ? 1 : getBoneGroupCount(mesh)] as const
    })
  )
}

// A scratch copy of the models folder (never the real one), with the effect folders emptied when asked.
const copyModels = (isEffectEmptied: boolean): string => {
  const scratch = mkdtempSync(join(tmpdir(), 'effect-sweep-models-'))
  cpSync(modelsRoot, scratch, { recursive: true })
  if (isEffectEmptied) {
    for (const folder of EFFECT_FOLDERS) {
      rmSync(join(scratch, folder), { recursive: true, force: true })
      mkdirSync(join(scratch, folder))
    }
  }
  return scratch
}

const formatCoverage = (coverage: EffectTextureCoverage): string =>
  `${coverage.label} ${String(coverage.differingCount)}/${String(coverage.pixelCount)} (${(getDifferingShare(coverage) * PERCENT).toFixed(0)}%)`

const formatRun = (run: EffectSweepRun): readonly string[] =>
  run.frames.map(
    (frame) =>
      `  ${run.mode} frame ${String(frame.frame)} (noise ${String(frame.unchangedDifference)}): ${frame.sightings
        .map(
          (sighting) =>
            `${sighting.origin} ${sighting.kind} ${sighting.key} x${String(sighting.count)}${sighting.partCounts.some((parts) => parts > 1) ? ` parts ${sighting.partCounts.join('/')}` : ''} ${String(sighting.changedPixels)} px`
        )
        .join(', ')}`
  )

// Fires every power-up colour and level in one race and looks at the effect three ways, one browser at a time: Classic against the
// original's frames (every piece of the effect the original paints shows in the port), the remastered layer with no effect file
// (every element is still the original's, as often, and still on screen) and with the player's files (each file drawn in place of
// its original, as often, on screen, a part per bone group). `EFFECT_SWEEP_CASES=grapple,magnet` limits the run; docs:
// pixel-trace.md, "Test coverage of effects".
describe.skipIf(!isClassicAvailable)('power-up effect sweep', () => {
  const classicRuns = new Map<string, EffectSweepRun>()
  const failures: EffectSweepFailure[] = []
  const reportLines: string[] = []
  const runKeys = new Set<string>()
  let boneGroupCounts: ReadonlyMap<string, number> = new Map()

  // A mode's failures of a case against the known gaps: unknown ones fail, and so do gaps it no longer finds.
  const judge = (
    sweepCase: PowerUpEffectCase,
    mode: EffectSweepMode,
    found: readonly EffectSweepFailure[]
  ) => {
    failures.push(...found)
    runKeys.add(`${sweepCase.name}|${mode}`)
    console.log(found.map((failure) => `  ${formatFailure(failure)}`).join('\n'))
    expect(
      getUnknownFailures(found, KNOWN_EFFECT_SWEEP_GAPS).map(formatFailure),
      'Fix: draw the effect as the original does (Classic), keep the original when the folder has no file, and draw a file in place of every piece of its original (power-up-visuals.md, remastered.md)'
    ).toEqual([])
    expect(
      getStaleGaps(sweepCase.name, mode, found, KNOWN_EFFECT_SWEEP_GAPS),
      'Fix: the sweep no longer finds these; remove them from KNOWN_EFFECT_SWEEP_GAPS (power-up-effect-sweep-gaps.ts)'
    ).toEqual([])
  }

  const getStatus = (sweepCase: PowerUpEffectCase, mode: EffectSweepMode): string => {
    if (!runKeys.has(`${sweepCase.name}|${mode}`)) return 'not run'
    const own = failures.filter(
      (failure) => failure.caseName === sweepCase.name && failure.mode === mode
    )
    if (own.length === 0) return 'ok'
    const isKnown = getUnknownFailures(own, KNOWN_EFFECT_SWEEP_GAPS).length === 0
    return `${isKnown ? 'known' : 'FAIL'}: ${own.map((failure) => `${failure.check} ${failure.key}`).join(', ')}`
  }

  beforeAll(() => {
    boneGroupCounts = getBoneGroupCounts(readOriginalJam())
  })

  afterAll(() => {
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
    const table = [
      `| Case | ${MODES.map((mode) => MODE_TITLES[mode]).join(' | ')} |`,
      `| ---- | ${MODES.map(() => '---').join(' | ')} |`,
      ...cases.map(
        (sweepCase) =>
          `| ${sweepCase.name} | ${MODES.map((mode) => getStatus(sweepCase, mode)).join(' | ')} |`
      ),
    ]
    writeFileSync(join(OUTPUT_DIRECTORY, 'results.json'), JSON.stringify(failures, null, 1))
    writeFileSync(
      join(OUTPUT_DIRECTORY, 'results.md'),
      [...table, '', ...reportLines, '', ...failures.map(formatFailure)].join('\n')
    )
    console.log(table.join('\n'))
  })

  describe('Classic against the original', () => {
    let page: TracePage | null = null
    beforeAll(async () => {
      if (chromePath === null) return
      page = await startTracePage({
        chromePath,
        pagePath: '/?effect-sweep',
        readyFunctionName: 'runEffectSweep',
        port: 5440,
        label: 'effect sweep, Classic',
      })
    }, SETUP_TIMEOUT_MILLISECONDS)
    afterAll(async () => {
      await page?.close()
    })

    it.each(cases)('draws every piece of the $name effect', async (sweepCase) => {
      // Arrange
      if (page === null) throw new Error('No browser')
      const jam = readOriginalJam()
      const recordFrames = sweepCase.request.recordFrames ?? []
      const scenario = createPresentationScenario(jam, {
        ...sweepCase.request,
        isRenderRecorded: true,
      })
      const original = await readOriginalPresentation(scenario)
      const held = await readOriginalPresentation(
        createPresentationScenario(jam, {
          ...getHeldCase(sweepCase).request,
          isRenderRecorded: true,
        })
      )
      const assets = loadScenarioAssets(jam, scenario)
      const effectTextures = getTexturesOfScenes([assets.effectModels.materials])
      const matches = matchTextures(
        original.textures,
        new Map([...getSceneTextures(assets), ...effectTextures])
      )
      const labels = new Map(
        [...matches].map(([hash, match]) => [hash, match.bestKey ?? hash] as const)
      )
      const getLabel = (hash: string) => labels.get(hash) ?? hash
      const effectHashes = new Set(
        [...matches]
          .filter(([, match]) => match.bestKey !== null && effectTextures.has(match.bestKey))
          .map(([hash]) => hash)
      )

      // Act
      const run = await runOnPage(page, 'classic', getPixelTraceRequest(scenario, recordFrames))
      const measured = run.frames.map((frame) => {
        const renderFrame = getRenderFrame(original, frame.frame)
        const reference = rasterise(original, renderFrame, true)
        const port = new Uint8ClampedArray(Buffer.from(frame.colorsBase64, 'base64'))
        const withoutHud = rasterise(original, renderFrame, false)
        const heldWithoutHud = rasterise(held, getRenderFrame(held, frame.frame), false)
        const unnamedEffectHashes = [...getNewPictureHashes(withoutHud, heldWithoutHud)].filter(
          (hash) => getLabel(hash) === hash
        )
        const mask = getEffectMask(withoutHud, new Set([...effectHashes, ...unnamedEffectHashes]))
        return {
          newPictureCounts: getNewPictureCounts(withoutHud, heldWithoutHud),
          coverages: getEffectTextureCoverages(reference, port, mask, TOLERANCE_LEVELS),
          regions: getEffectRegions(frame.frame, reference, port, mask, TOLERANCE_LEVELS),
        }
      })
      const coverages = sumTextureCoverages(measured.flatMap((frame) => frame.coverages)).map(
        (coverage) => ({ ...coverage, label: getLabel(coverage.hash) })
      )
      const regions: readonly EffectRegion[] = measured.flatMap((frame) =>
        frame.regions.map((region) => ({ ...region, label: getLabel(region.hash) }))
      )
      const unnamed = getUnnamedNewPictures(
        measured.map((frame) => frame.newPictureCounts),
        labels
      )
      classicRuns.set(sweepCase.name, {
        ...run,
        frames: run.frames.map((frame) => ({ ...frame, colorsBase64: '' })),
      })
      const found: readonly EffectSweepFailure[] = [
        ...getClassicFailures(sweepCase.name, regions, MAXIMUM_DIFFERING_SHARE),
        ...(run.webglErrors.length === 0
          ? []
          : [
              {
                caseName: sweepCase.name,
                mode: 'classic' as const,
                check: 'webgl' as const,
                key: 'renderer',
                detail: run.webglErrors.join(', '),
              },
            ]),
      ]
      const worstRegions = [...regions]
        .filter((region) => region.pixelCount >= REPORTED_REGION_PIXELS)
        .sort(
          (first, second) =>
            second.differingCount / second.pixelCount - first.differingCount / first.pixelCount
        )
        .slice(0, REPORTED_REGION_COUNT)
        .map(
          (region) =>
            `${region.label} ${String(region.frame)} x ${String(region.left)}-${String(region.right)} y ${String(region.top)}-${String(region.bottom)} ${String(region.differingCount)}/${String(region.pixelCount)}`
        )
      const pictures = `effect pictures ${coverages.map(formatCoverage).join(', ') || 'none'}; worst pieces ${worstRegions.join(', ') || 'none'}; unnamed new pictures ${unnamed.join(', ') || 'none'}`
      reportLines.push(`${sweepCase.name}: ${pictures}`)

      // Assert
      console.log([`${sweepCase.name}: ${pictures}`, ...formatRun(run)].join('\n'))
      judge(sweepCase, 'classic', found)
    })
  })

  // The layer in one browser at a time, on the models folder of its mode: its development server reads the folder when it starts.
  const describeLayer = (mode: EffectSweepMode, isEffectEmptied: boolean, port: number) =>
    describe.skipIf(!isLayerAvailable)(MODE_TITLES[mode], () => {
      let page: TracePage | null = null
      let scratch: string | null = null
      beforeAll(async () => {
        if (chromePath === null) return
        scratch = copyModels(isEffectEmptied)
        environment['LEGO_LDRAW_MODELS_ROOT'] = scratch
        try {
          page = await startTracePage({
            chromePath,
            pagePath: '/?hd&effect-sweep',
            readyFunctionName: 'runEffectSweep',
            port,
            label: `effect sweep, ${MODE_TITLES[mode]}`,
          })
        } finally {
          environment['LEGO_LDRAW_MODELS_ROOT'] = modelsRoot
        }
      }, SETUP_TIMEOUT_MILLISECONDS)
      afterAll(async () => {
        await page?.close()
        if (scratch !== null) rmSync(scratch, { recursive: true, force: true })
      })

      it.each(cases)('draws the $name effect as Classic does', async (sweepCase) => {
        // Arrange
        if (page === null) throw new Error('No browser')
        const classic = classicRuns.get(sweepCase.name)
        if (classic === undefined) throw new Error(`No Classic run of ${sweepCase.name}`)
        const scenario = createPresentationScenario(readOriginalJam(), {
          ...sweepCase.request,
          isRenderRecorded: true,
        })

        // Act
        const run = await runOnPage(
          page,
          mode,
          getPixelTraceRequest(scenario, sweepCase.request.recordFrames ?? [])
        )
        const found = getLayerFailures(sweepCase.name, classic, run, boneGroupCounts)

        // Assert
        console.log([sweepCase.name, ...formatRun(run)].join('\n'))
        judge(sweepCase, mode, found)
      })
    })

  describeLayer('hd_empty', true, 5450)
  describeLayer('hd_files', false, 5460)
})
