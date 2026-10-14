import type { RasterisedFrame } from '@lego-games/lego-racers/presentation-trace'
import type { SceneMesh } from '@lego-games/lego-racers/scene'
import type {
  EffectSighting,
  EffectSweepFrame,
} from '../../../../shared/effect-sweep/effect-sweep.types.ts'
import {
  getBoneGroupCount,
  getClassicFailures,
  getEffectMask,
  getEffectRegions,
  getEffectTextureCoverages,
  getNewPictureCounts,
  getNewPictureHashes,
  getLayerFailures,
  getStaleGaps,
  getUnknownFailures,
} from './power-up-effect-sweep-judgement.ts'
import type {
  EffectSweepFailure,
  EffectSweepRun,
  KnownEffectSweepGap,
} from './power-up-effect-sweep.types.ts'

const getSighting = (change: Partial<EffectSighting>): EffectSighting => ({
  origin: 'original',
  kind: 'model',
  key: 'DT2CBURN',
  count: 1,
  emptyCount: 0,
  partCounts: [1],
  changedPixels: 900,
  ...change,
})

const getRun = (
  mode: EffectSweepRun['mode'],
  sightings: readonly EffectSighting[],
  change: Partial<EffectSweepRun> = {}
): EffectSweepRun => {
  const frame: EffectSweepFrame = {
    frame: 320,
    colorsBase64: '',
    unchangedDifference: 0,
    sightings,
  }
  return { mode, frames: [frame], calls: [], webglErrors: [], ...change }
}

const getMesh = (transformIndices: readonly number[]): SceneMesh =>
  ({
    drawBatches: [
      {
        materialSlot: 0,
        firstCommand: 0,
        vertexIndices: new Uint32Array(transformIndices.length),
        transformIndices: new Uint8Array(transformIndices),
      },
    ],
  }) as unknown as SceneMesh

const getRaster = (
  colors: readonly number[][],
  hashIndices: readonly number[]
): RasterisedFrame => ({
  width: colors.length,
  height: 1,
  colors: new Uint8ClampedArray(colors.flat()),
  textureIndices: new Int16Array(hashIndices),
  textureHashes: ['hook', 'road'],
})

describe('getNewPictureCounts and getNewPictureHashes', () => {
  it('lists the pictures the fired race paints at least 50 pixels more of than the held race', () => {
    // Arrange
    const fired = getRaster(
      Array.from({ length: 160 }, () => [0, 0, 0, 255]),
      Array.from({ length: 160 }, (_, pixel) => (pixel < 60 ? 0 : 1))
    )
    const held = getRaster(
      Array.from({ length: 160 }, () => [0, 0, 0, 255]),
      Array.from({ length: 160 }, (_, pixel) => (pixel < 5 ? 0 : 1))
    )

    // Act
    const counts = getNewPictureCounts(fired, held)
    const hashes = getNewPictureHashes(fired, held)

    // Assert
    expect([...counts]).toEqual([['hook', 55]])
    expect([...hashes]).toEqual(['hook'])
  })
})

describe('getEffectMask, getEffectTextureCoverages and getClassicFailures', () => {
  it('fails a picture of the effect that the port does not draw where the original paints it', () => {
    // Arrange: 100 pixels of the hook and 20 of the road; the port draws the road under 60 of the hook's
    const hook = [200, 0, 0, 255]
    const road = [50, 50, 50, 255]
    const reference = getRaster(
      Array.from({ length: 120 }, (_, pixel) => (pixel < 100 ? hook : road)),
      Array.from({ length: 120 }, (_, pixel) => (pixel < 100 ? 0 : 1))
    )
    const port = new Uint8ClampedArray(
      Array.from({ length: 120 }, (_, pixel) => (pixel < 60 || pixel >= 100 ? road : hook)).flat()
    )

    // Act
    const mask = getEffectMask(reference, new Set(['hook']))
    const coverages = getEffectTextureCoverages(reference, port, mask, 32)
    const regions = getEffectRegions(320, reference, port, mask, 32)
    const failures = getClassicFailures('red 1 grapple', regions, 0.5)

    // Assert
    expect(coverages).toEqual([
      { hash: 'hook', label: 'hook', pixelCount: 100, differingCount: 60 },
    ])
    expect(regions).toEqual([
      {
        frame: 320,
        hash: 'hook',
        label: 'hook',
        pixelCount: 100,
        differingCount: 60,
        left: 0,
        top: 0,
        right: 99,
        bottom: 0,
      },
    ])
    expect(failures.map((failure) => failure.key)).toEqual(['hook'])
  })
})

describe('getBoneGroupCount', () => {
  it('counts the groups of bones joined by triangles', () => {
    // Arrange: the twin burner, one triangle on bone 1 and one on bone 2; a ring whose triangles join bones 1 and 2
    const twin = getMesh([1, 1, 1, 2, 2, 2])
    const ring = getMesh([1, 1, 2, 2, 2, 2])

    // Act
    const counts = [twin, ring].map(getBoneGroupCount)

    // Assert
    expect(counts).toEqual([2, 1])
  })
})

describe('getLayerFailures', () => {
  it('passes a layer that leaves an element without a file to the original', () => {
    // Arrange
    const classic = getRun('classic', [getSighting({})])
    const layer = getRun('hd_empty', [getSighting({ changedPixels: 800 })])

    // Act
    const failures = getLayerFailures('green 2 twin turbo', classic, layer, new Map())

    // Assert
    expect(failures).toEqual([])
  })

  it('fails an original element the layer drops, hides or draws twice, and a file the original still draws', () => {
    // Arrange
    const classic = getRun('classic', [
      getSighting({ key: 'MAGNET04' }),
      getSighting({ key: 'CURSE' }),
      getSighting({ key: 'BARREL' }),
    ])
    const layer = getRun(
      'hd_files',
      [
        getSighting({ key: 'CURSE', changedPixels: 10 }),
        getSighting({ key: 'BARREL' }),
        getSighting({ origin: 'layer', key: 'BARREL' }),
      ],
      { calls: [{ key: 'BARREL', isModelPresent: true, isDrawingReturned: true }] }
    )

    // Act
    const failures = getLayerFailures('yellow', classic, layer, new Map())

    // Assert
    expect(failures.map((failure) => `${failure.check} ${failure.key}`)).toEqual([
      'count model BARREL',
      'doubled model BARREL',
      'file model BARREL',
      'hidden model CURSE',
      'count model MAGNET04',
    ])
  })

  it('fails a drawing with fewer posed parts than the bone groups of its mesh, or never on screen', () => {
    // Arrange
    const classic = getRun('classic', [getSighting({})])
    const layer = getRun('hd_files', [
      getSighting({ origin: 'layer', partCounts: [1], changedPixels: 0 }),
    ])

    // Act
    const failures = getLayerFailures(
      'green 2 twin turbo',
      classic,
      layer,
      new Map([['DT2CBURN', 2]])
    )

    // Assert
    expect(failures.map((failure) => `${failure.check} ${failure.key}`)).toEqual([
      'parts model DT2CBURN',
      'hidden model DT2CBURN',
    ])
  })
})

describe('known gaps', () => {
  it('lets a known failure pass and fails a gap that is no longer found', () => {
    // Arrange
    const failure: EffectSweepFailure = {
      caseName: 'red 1 grapple',
      mode: 'classic',
      check: 'texture',
      key: 'abc',
      detail: '',
    }
    const gaps: readonly KnownEffectSweepGap[] = [
      { caseName: 'red 1 grapple', mode: 'classic', check: 'texture', key: 'abc', reason: '' },
      { caseName: 'red 1 grapple', mode: 'classic', check: 'texture', key: 'old', reason: '' },
    ]

    // Act
    const unknown = getUnknownFailures([failure], gaps)
    const stale = getStaleGaps('red 1 grapple', 'classic', [failure], gaps)

    // Assert
    expect(unknown).toEqual([])
    expect(stale.map((gap) => gap.key)).toEqual(['old'])
  })
})
