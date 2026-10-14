import type { RasterisedFrame } from '@lego-games/lego-racers/presentation-trace'
import type { SceneMesh } from '@lego-games/lego-racers/scene'
import type {
  EffectSighting,
  EffectSweepFrame,
} from '../../../../shared/effect-sweep/effect-sweep.types.ts'
import type {
  EffectSweepFailure,
  EffectSweepMode,
  EffectRegion,
  EffectSweepRun,
  EffectTextureCoverage,
  KnownEffectSweepGap,
} from './power-up-effect-sweep.types.ts'

const CHANNELS_PER_PIXEL = 4
const COLOR_CHANNELS = 3
const TRIANGLE_CORNERS = 3
// A picture of the effect is judged once the effect paints this many pixels with it over a case's frames.
const MINIMUM_EFFECT_PIXELS = 50
const UNTEXTURED = 'untextured'
const MINIMUM_REGION_PIXELS = 30
// Fewer changed pixels than this above the frame's noise is nothing on screen (the on-screen check's measure).
const MINIMUM_CHANGED_PIXELS = 50
// An original element the layer leaves alone changes at least this share of the pixels it changes in Classic.
const MINIMUM_SHOWN_SHARE = 0.5

const getIsDiffering = (
  reference: Uint8ClampedArray,
  port: Uint8ClampedArray,
  offset: number,
  channelLevels: number
): boolean => {
  for (let channel = 0; channel < COLOR_CHANNELS; channel++) {
    const difference = (reference[offset + channel] ?? 0) - (port[offset + channel] ?? 0)
    if (Math.abs(difference) > channelLevels) return true
  }
  return false
}

// The pixels the original paints last with one of the effect's pictures (the power-up libraries' textures).
export const getEffectMask = (
  raster: RasterisedFrame,
  effectHashes: ReadonlySet<string>
): Uint8Array =>
  Uint8Array.from(raster.textureIndices, (index) => {
    const hash = raster.textureHashes[index]
    return hash !== undefined && effectHashes.has(hash) ? 1 : 0
  })

// The pictures the fired race paints in a frame at least 50 pixels more of than the held race (the control, where the brick is never
// fired), by how many more: what a reader looks at when a picture of the effect is one the port has no name for.
export const getNewPictureCounts = (
  fired: RasterisedFrame,
  held: RasterisedFrame
): ReadonlyMap<string, number> => {
  const firedCounts = getPixelCounts(fired)
  const heldCounts = getPixelCounts(held)
  return new Map(
    [...firedCounts]
      .map(([hash, count]) => [hash, count - (heldCounts.get(hash) ?? 0)] as const)
      .filter(([, increase]) => increase >= MINIMUM_EFFECT_PIXELS)
  )
}

// The pictures of a frame that only the fired race paints: at least 50 pixels of them, and the held race at most half as many. A
// picture the port has no name for (the curse's `curse1`) is the effect's when it is new in this sense.
export const getNewPictureHashes = (
  fired: RasterisedFrame,
  held: RasterisedFrame
): ReadonlySet<string> => {
  const heldCounts = getPixelCounts(held)
  return new Set(
    [...getPixelCounts(fired)]
      .filter(
        ([hash, count]) =>
          hash !== UNTEXTURED &&
          count >= MINIMUM_EFFECT_PIXELS &&
          (heldCounts.get(hash) ?? 0) * 2 <= count
      )
      .map(([hash]) => hash)
  )
}

const getPixelCounts = (raster: RasterisedFrame): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const index of raster.textureIndices) {
    const hash = raster.textureHashes[index] ?? UNTEXTURED
    counts.set(hash, (counts.get(hash) ?? 0) + 1)
  }
  return counts
}

// Of the pixels the effect's pictures paint in the original's frame, how many the port gets wrong, by picture.
export const getEffectTextureCoverages = (
  reference: RasterisedFrame,
  port: Uint8ClampedArray,
  mask: Uint8Array,
  channelLevels: number
): readonly EffectTextureCoverage[] => {
  const coverages = new Map<string, EffectTextureCoverage>()
  for (const [pixel, isMasked] of mask.entries()) {
    if (isMasked === 0) continue
    const hash = reference.textureHashes[reference.textureIndices[pixel] ?? -1] ?? UNTEXTURED
    const coverage = coverages.get(hash) ?? { hash, label: hash, pixelCount: 0, differingCount: 0 }
    const isDiffering = getIsDiffering(
      reference.colors,
      port,
      pixel * CHANNELS_PER_PIXEL,
      channelLevels
    )
    coverages.set(hash, {
      ...coverage,
      pixelCount: coverage.pixelCount + 1,
      differingCount: coverage.differingCount + (isDiffering ? 1 : 0),
    })
  }
  return [...coverages.values()]
}

// The coverages of several frames added up per picture.
export const sumTextureCoverages = (
  coverages: readonly EffectTextureCoverage[]
): readonly EffectTextureCoverage[] => {
  const sums = new Map<string, EffectTextureCoverage>()
  for (const coverage of coverages) {
    const sum = sums.get(coverage.hash)
    sums.set(
      coverage.hash,
      sum === undefined
        ? coverage
        : {
            ...sum,
            pixelCount: sum.pixelCount + coverage.pixelCount,
            differingCount: sum.differingCount + coverage.differingCount,
          }
    )
  }
  return [...sums.values()].sort((first, second) => second.pixelCount - first.pixelCount)
}

export const getDifferingShare = (coverage: EffectTextureCoverage): number =>
  coverage.pixelCount === 0 ? 0 : coverage.differingCount / coverage.pixelCount

const getNeighbours = (pixel: number, width: number, height: number): readonly number[] => {
  const x = pixel % width
  const y = Math.floor(pixel / width)
  const neighbours: number[] = []
  for (let deltaY = -1; deltaY <= 1; deltaY++) {
    for (let deltaX = -1; deltaX <= 1; deltaX++) {
      const neighbourX = x + deltaX
      const neighbourY = y + deltaY
      const isInside =
        neighbourX >= 0 && neighbourX < width && neighbourY >= 0 && neighbourY < height
      if (isInside && (deltaX !== 0 || deltaY !== 0))
        neighbours.push(neighbourY * width + neighbourX)
    }
  }
  return neighbours
}

const getDominantHash = (counts: ReadonlyMap<string, number>): string =>
  [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best), [UNTEXTURED, 0])[0]

// The effect's pieces on the screen: the 8-connected regions of the pixels its pictures paint, each with the picture that paints
// most of it and how many of its pixels the port gets wrong. A missing hook is a region the port draws none of, however much else
// of the frame the same picture paints.
export const getEffectRegions = (
  frame: number,
  reference: RasterisedFrame,
  port: Uint8ClampedArray,
  mask: Uint8Array,
  channelLevels: number
): readonly EffectRegion[] => {
  const { width, height } = reference
  const isVisited = new Uint8Array(mask.length)
  const regions: EffectRegion[] = []
  for (const [seed, isMasked] of mask.entries()) {
    if (isMasked === 0 || isVisited[seed] === 1) continue
    isVisited[seed] = 1
    const pending = [seed]
    const hashCounts = new Map<string, number>()
    let region = { frame, hash: '', label: '', pixelCount: 0, differingCount: 0 }
    let bounds = { left: width, top: height, right: 0, bottom: 0 }
    for (let pixel = pending.pop(); pixel !== undefined; pixel = pending.pop()) {
      const hash = reference.textureHashes[reference.textureIndices[pixel] ?? -1] ?? UNTEXTURED
      hashCounts.set(hash, (hashCounts.get(hash) ?? 0) + 1)
      const isDiffering = getIsDiffering(
        reference.colors,
        port,
        pixel * CHANNELS_PER_PIXEL,
        channelLevels
      )
      region = {
        ...region,
        pixelCount: region.pixelCount + 1,
        differingCount: region.differingCount + (isDiffering ? 1 : 0),
      }
      const x = pixel % width
      const y = Math.floor(pixel / width)
      bounds = {
        left: Math.min(bounds.left, x),
        top: Math.min(bounds.top, y),
        right: Math.max(bounds.right, x),
        bottom: Math.max(bounds.bottom, y),
      }
      for (const neighbour of getNeighbours(pixel, width, height)) {
        if (mask[neighbour] === 1 && isVisited[neighbour] === 0) {
          isVisited[neighbour] = 1
          pending.push(neighbour)
        }
      }
    }
    const hash = getDominantHash(hashCounts)
    regions.push({ ...region, ...bounds, hash, label: hash })
  }
  return regions
}

// Classic: every piece of the effect the original paints shows in the port: a region of at least 30 pixels of which more than
// the given share differs fails, by its picture.
export const getClassicFailures = (
  caseName: string,
  regions: readonly EffectRegion[],
  maximumDifferingShare: number
): readonly EffectSweepFailure[] => {
  const failing = regions.filter(
    (region) =>
      region.pixelCount >= MINIMUM_REGION_PIXELS &&
      region.differingCount / region.pixelCount > maximumDifferingShare
  )
  return [...new Set(failing.map((region) => region.hash))].map((hash) => {
    const own = failing.filter((region) => region.hash === hash)
    return {
      caseName,
      mode: 'classic',
      check: 'texture',
      key: hash,
      detail: own
        .map(
          (region) =>
            `${region.label} frame ${String(region.frame)} x ${String(region.left)}-${String(region.right)} y ${String(region.top)}-${String(region.bottom)}: ${String(region.differingCount)} of ${String(region.pixelCount)} pixels differ`
        )
        .join('; '),
    }
  })
}

// How many separately moved pieces a mesh is: the original moves each vertex by its own bone (GolDP.dll 0x10023b10), and the bones
// a triangle joins move together, so the groups of bones joined by triangles are the pieces (the twin turbo's two burners).
export const getBoneGroupCount = (mesh: SceneMesh): number => {
  const parents = new Map<number, number>()
  const getRoot = (bone: number): number => {
    let root = bone
    for (let parent = parents.get(root); parent !== undefined && parent !== root;) {
      root = parent
      parent = parents.get(root)
    }
    return root
  }
  for (const batch of mesh.drawBatches) {
    for (let corner = 0; corner + TRIANGLE_CORNERS <= batch.transformIndices.length;) {
      const bones = [...batch.transformIndices.subarray(corner, corner + TRIANGLE_CORNERS)]
      for (const bone of bones) if (!parents.has(bone)) parents.set(bone, bone)
      const [first, ...rest] = bones.map(getRoot)
      for (const root of rest) if (first !== undefined) parents.set(root, first)
      corner += TRIANGLE_CORNERS
    }
  }
  return Math.max(1, new Set([...parents.keys()].map(getRoot)).size)
}

const getElementKey = (sighting: EffectSighting): string => `${sighting.kind} ${sighting.key}`

const getSightings = (
  frame: EffectSweepFrame | undefined,
  origin: EffectSighting['origin'],
  elementKey: string
): readonly EffectSighting[] =>
  (frame?.sightings ?? []).filter(
    (sighting) => sighting.origin === origin && getElementKey(sighting) === elementKey
  )

const getCount = (sightings: readonly EffectSighting[]): number =>
  sightings.reduce((sum, sighting) => sum + sighting.count, 0)

const getChangedPixels = (sightings: readonly EffectSighting[]): number =>
  sightings.reduce((sum, sighting) => sum + sighting.changedPixels, 0)

const getIsShown = (frame: EffectSweepFrame, changedPixels: number): boolean =>
  changedPixels >= MINIMUM_CHANGED_PIXELS + frame.unchangedDifference

// Every effect element the frames of the runs draw (`model DMISSILE`, `particle smoke1`), sorted.
const getElementKeys = (runs: readonly EffectSweepRun[]): readonly string[] =>
  [
    ...new Set(
      runs.flatMap((run) =>
        run.frames.flatMap((frame) =>
          frame.sightings.filter((sighting) => !getIsSharedDrawing(sighting)).map(getElementKey)
        )
      )
    ),
  ].sort()

// The layer draws the particles of several materials with one drawing, known by the first material asked for: its sightings say
// nothing of the materials it took over, which the calls tell.
const getIsSharedDrawing = (sighting: EffectSighting): boolean =>
  sighting.origin === 'layer' && sighting.kind === 'particle'

const getHandledKeys = (run: EffectSweepRun): ReadonlySet<string> =>
  new Set(run.calls.filter((call) => call.isDrawingReturned).map((call) => call.key))

const getFileKeys = (run: EffectSweepRun): ReadonlySet<string> =>
  new Set(run.calls.filter((call) => call.isModelPresent).map((call) => call.key))

// The remastered layer against Classic, frame by frame: every effect element Classic draws is drawn as often (by the original or in
// its place by the layer, never by both); an element the folder has a file for is the layer's; an element the layer leaves alone
// still reaches the screen; a drawing of the layer reaches the screen in a frame where the original did, with a posed part for
// every bone group of the original's mesh.
export const getLayerFailures = (
  caseName: string,
  classic: EffectSweepRun,
  layer: EffectSweepRun,
  boneGroupCounts: ReadonlyMap<string, number>
): readonly EffectSweepFailure[] => {
  const { mode } = layer
  const fileKeys = getFileKeys(layer)
  const handledKeys = getHandledKeys(layer)
  const getFailure = (
    check: EffectSweepFailure['check'],
    elementKey: string,
    detail: string
  ): EffectSweepFailure => ({ caseName, mode, check, key: elementKey, detail })
  const elementFailures = getElementKeys([classic, layer]).flatMap((elementKey) => {
    const frames = classic.frames.map((classicFrame) => {
      const layerFrame = layer.frames.find((candidate) => candidate.frame === classicFrame.frame)
      const original = getSightings(classicFrame, 'original', elementKey)
      const kept = getSightings(layerFrame, 'original', elementKey)
      const replaced = getSightings(layerFrame, 'layer', elementKey).filter(
        (sighting) => !getIsSharedDrawing(sighting)
      )
      return { classicFrame, layerFrame, original, kept, replaced }
    })
    const failures: EffectSweepFailure[] = []
    const key = elementKey.split(' ').slice(1).join(' ')
    const isTakenByParticleDrawing = elementKey.startsWith('particle ') && handledKeys.has(key)
    const miscounted = frames.filter((frame) =>
      isTakenByParticleDrawing
        ? getCount(frame.kept) > 0
        : getCount(frame.original) !== getCount(frame.kept) + getCount(frame.replaced)
    )
    if (miscounted.length > 0)
      failures.push(
        getFailure(
          'count',
          elementKey,
          miscounted
            .map(
              (frame) =>
                `frame ${String(frame.classicFrame.frame)}: Classic ${String(getCount(frame.original))}, original ${String(getCount(frame.kept))} + layer ${String(getCount(frame.replaced))}`
            )
            .join('; ')
        )
      )
    if (frames.some((frame) => getCount(frame.kept) > 0 && getCount(frame.replaced) > 0))
      failures.push(getFailure('doubled', elementKey, 'the original and the layer both draw it'))
    if (fileKeys.has(key) && frames.some((frame) => getCount(frame.kept) > 0))
      failures.push(getFailure('file', elementKey, 'the folder has its file, the original draws'))
    const fewParts = frames.flatMap((frame) =>
      frame.replaced.flatMap((sighting) =>
        sighting.partCounts.filter((parts) => parts < (boneGroupCounts.get(key) ?? 1))
      )
    )
    if (fewParts.length > 0)
      failures.push(
        getFailure(
          'parts',
          elementKey,
          `drawn as ${String(Math.min(...fewParts))} posed part(s), the original's mesh is ${String(boneGroupCounts.get(key) ?? 1)} bone groups`
        )
      )
    const fadedFrames = frames.filter(
      (frame) =>
        frame.layerFrame !== undefined &&
        getCount(frame.kept) > 0 &&
        getIsShown(frame.classicFrame, getChangedPixels(frame.original)) &&
        getChangedPixels(frame.kept) < getChangedPixels(frame.original) * MINIMUM_SHOWN_SHARE
    )
    if (fadedFrames.length > 0)
      failures.push(
        getFailure(
          'hidden',
          elementKey,
          fadedFrames
            .map(
              (frame) =>
                `frame ${String(frame.classicFrame.frame)}: ${String(getChangedPixels(frame.kept))} pixels, Classic ${String(getChangedPixels(frame.original))}`
            )
            .join('; ')
        )
      )
    const shownByOriginal = frames.filter(
      (frame) =>
        frame.layerFrame !== undefined &&
        getCount(frame.replaced) > 0 &&
        getIsShown(frame.classicFrame, getChangedPixels(frame.original))
    )
    const isLayerShown = shownByOriginal.some(
      (frame) =>
        frame.layerFrame !== undefined &&
        getIsShown(frame.layerFrame, getChangedPixels(frame.replaced))
    )
    if (shownByOriginal.length > 0 && !isLayerShown)
      failures.push(
        getFailure(
          'hidden',
          elementKey,
          "the layer's drawing reached the screen in none of the frames the original's did"
        )
      )
    return failures
  })
  return layer.webglErrors.length === 0
    ? elementFailures
    : [
        ...elementFailures,
        getFailure(
          'webgl',
          'renderer',
          layer.webglErrors.map((error) => `0x${error.toString(16)}`).join(', ')
        ),
      ]
}

const getIsGapOf = (gap: KnownEffectSweepGap, failure: EffectSweepFailure): boolean =>
  gap.caseName === failure.caseName &&
  gap.mode === failure.mode &&
  gap.check === failure.check &&
  gap.key === failure.key

// The failures no known gap stands for: the sweep fails on them.
export const getUnknownFailures = (
  failures: readonly EffectSweepFailure[],
  gaps: readonly KnownEffectSweepGap[]
): readonly EffectSweepFailure[] =>
  failures.filter((failure) => !gaps.some((gap) => getIsGapOf(gap, failure)))

// The known gaps of a case and mode that the run no longer finds: fixed, so they leave the list.
export const getStaleGaps = (
  caseName: string,
  mode: EffectSweepMode,
  failures: readonly EffectSweepFailure[],
  gaps: readonly KnownEffectSweepGap[]
): readonly KnownEffectSweepGap[] =>
  gaps.filter(
    (gap) =>
      gap.caseName === caseName &&
      gap.mode === mode &&
      !failures.some((failure) => getIsGapOf(gap, failure))
  )

export const formatFailure = (failure: EffectSweepFailure): string =>
  `${failure.caseName} [${failure.mode}] ${failure.check} ${failure.key}: ${failure.detail}`
