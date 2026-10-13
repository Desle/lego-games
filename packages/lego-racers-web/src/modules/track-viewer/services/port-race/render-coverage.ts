import { parseCircuitDatabase } from '@lego-games/lego-racers/circuit-database'
import { decodeBitmap, getBitmapColors } from '@lego-games/lego-racers/bitmap'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsFragmentOfPolygon,
  getIsCutPiece,
  matchTextures,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import type {
  DrawnTriangle,
  DrawState,
  PortTexture,
} from '@lego-games/lego-racers/presentation-trace'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  stepRace,
} from '@lego-games/lego-racers/race'
import { parseRaceCatalog } from '@lego-games/lego-racers/race-catalog'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import { readOriginalJam } from './original-game-files.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { ORIGINAL_STAGE_SIZE, runPortRace } from './port-race.ts'
import { compareWorldFrame, getSceneTextures, RACE_DEPTH_RANGE } from './render-comparison.ts'
import type {
  CoverageExtraRow,
  CoverageBounds,
  CoverageFrameRow,
  CoverageLapProbe,
  CoverageMismatchRow,
  CoverageOptions,
  CoverageRace,
  CoverageTextureRow,
  GroupAccumulator,
  TextureAccumulator,
  RaceCoverage,
} from './render-coverage.types.ts'
import { createPresentationScenario } from './trace-scenarios.ts'

const FRAME_MILLISECONDS = 33
const START_FRAMES = [5, 100, 170] as const
const FIRST_RACING_FRAME = 250
const FINISH_FRAMES_AFTER = [5, 60] as const
// Six cars of about ten parts each have a model matrix of their own (render-trace.md finding 18).
const CANDIDATE_COUNT = 80
const SOURCE_LIMIT = 4
const MINIMUM_TRUSTED_SHARE = 0.6
const BLEND_ONE = 'one'
const MISMATCH_KINDS: readonly string[] = ['texture', 'texture_coordinates', 'color', 'state']
const UNKNOWN_TEXTURE = 'unknown'

// The races of LEGORACE.RCB with a circuit (the test track has none), forward and mirrored second passes.
export const getCoverageRaces = (jam: Uint8Array): readonly CoverageRace[] => {
  const archive = openJamArchive(jam)
  const circuits = parseCircuitDatabase(archive.readFile('MENUDATA\\LEGORACE.CRB'))
  const catalog = parseRaceCatalog(archive.readFile('MENUDATA\\LEGORACE.RCB'), circuits)
  return catalog.entries.flatMap((entry): readonly CoverageRace[] => {
    if (entry.name === 'test') return []
    const sibling = catalog.entries.find(
      (candidate) => candidate.firstName === entry.firstName && candidate.circuitName !== ''
    )
    const circuit = [entry.circuitName, sibling?.circuitName].flatMap((name) =>
      circuits.circuits.filter((candidate) => candidate.name === name)
    )[0]
    if (circuit === undefined) return []
    return [
      Object.freeze({
        catalogName: entry.name,
        raceFolder: entry.firstName.toUpperCase(),
        circuitName: circuit.name,
        isMirrored: entry.isFlagged,
        racerCodes: circuit.racerCodes,
      }),
    ]
  })
}

const getScenarioRequest = (
  race: CoverageRace,
  frameCount: number,
  recordFrames: readonly number[]
) => ({
  name: `coverage ${race.catalogName}`,
  raceFolder: race.raceFolder,
  racerCodes: race.racerCodes,
  circuitName: race.circuitName,
  isMirrored: race.isMirrored,
  localPlayerCount: 0,
  frameCount,
  recordFrames,
  isRenderRecorded: true,
})

let jamBitmapTextures: ReadonlyMap<string, PortTexture> | null = null

// Every bitmap of LEGO.JAM by path: the pictures the port may not load for the race, to name a surface the original draws.
const getJamBitmapTextures = (jam: Uint8Array): ReadonlyMap<string, PortTexture> => {
  if (jamBitmapTextures !== null) return jamBitmapTextures
  const archive = openJamArchive(jam)
  const textures = new Map<string, PortTexture>()
  for (const path of archive.getFilePaths()) {
    if (!path.toUpperCase().endsWith('.BMP')) continue
    try {
      const bitmap = decodeBitmap(archive.readFile(path))
      textures.set(path, {
        width: bitmap.width,
        height: bitmap.height,
        colors: getBitmapColors(bitmap),
      })
    } catch {
      continue
    }
  }
  jamBitmapTextures = textures
  return textures
}

// Runs the port's demonstration without drawing: the frames of the first lap line and of the first final place.
export const probeDemonstration = (race: CoverageRace, maximumFrames: number): CoverageLapProbe => {
  const jam = readOriginalJam()
  const scenario = createPresentationScenario(jam, getScenarioRequest(race, 1, []))
  const { definition } = loadScenarioAssets(jam, scenario)
  const inputs = { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS }
  let raceState = createRace(definition)
  let lapEndFrame: number | null = null
  let finishFrame: number | null = null
  let frame = 0
  for (; frame < maximumFrames && finishFrame === null; frame += 1) {
    raceState = stepRace(raceState, inputs, FRAME_MILLISECONDS).raceState
    if (lapEndFrame === null && (raceState.racerSet.racers[0]?.currentLap ?? 0) >= 1) {
      lapEndFrame = frame
    }
    if (raceState.finishedRacerCount > 0) finishFrame = frame
  }
  return Object.freeze({ lapEndFrame, finishFrame, probedFrameCount: frame })
}

// Start, then every interval through the first lap, its end, and the finish when the demonstration reaches one.
export const getRecordFrames = (
  probe: CoverageLapProbe,
  options: CoverageOptions
): readonly number[] => {
  const lapEnd = probe.lapEndFrame ?? probe.probedFrameCount - 1
  const sweep: number[] = []
  for (let frame = FIRST_RACING_FRAME; frame < lapEnd; frame += options.intervalFrames) {
    sweep.push(frame)
  }
  const finish =
    probe.finishFrame === null
      ? []
      : FINISH_FRAMES_AFTER.map((after) => (probe.finishFrame ?? 0) + after)
  return [...new Set([...START_FRAMES, ...sweep, lapEnd, ...finish])].sort(
    (left, right) => left - right
  )
}

const getStateLabel = (state: DrawState): string => {
  const kind = state.isBlendEnabled
    ? state.destinationBlend === BLEND_ONE
      ? 'additive'
      : 'blend'
    : state.isAlphaTestEnabled
      ? 'alpha_test'
      : 'opaque'
  return `${kind}/${state.colorOperation}`
}

const getScreenArea = (triangle: DrawnTriangle): number => {
  const [first, second, third] = triangle.vertices
  return Math.abs(
    ((second.x - first.x) * (third.y - first.y) - (third.x - first.x) * (second.y - first.y)) / 2
  )
}

const getWidenedBounds = (
  bounds: CoverageBounds | null,
  triangle: DrawnTriangle
): CoverageBounds => {
  const xs = triangle.vertices.map((vertex) => vertex.x)
  const ys = triangle.vertices.map((vertex) => vertex.y)
  return {
    left: Math.round(Math.min(bounds?.left ?? Infinity, ...xs)),
    top: Math.round(Math.min(bounds?.top ?? Infinity, ...ys)),
    right: Math.round(Math.max(bounds?.right ?? -Infinity, ...xs)),
    bottom: Math.round(Math.max(bounds?.bottom ?? -Infinity, ...ys)),
  }
}

const getWidenedDepthRange = (
  range: [number, number] | null,
  triangle: DrawnTriangle
): [number, number] => {
  const depths = triangle.vertices.map((vertex) => 1 / vertex.reciprocalW)
  return [Math.min(range?.[0] ?? Infinity, ...depths), Math.max(range?.[1] ?? -Infinity, ...depths)]
}

export const getOrCreate = <Value>(
  map: Map<string, Value>,
  key: string,
  create: () => Value
): Value => {
  const known = map.get(key)
  if (known !== undefined) return known
  const created = create()
  map.set(key, created)
  return created
}

// Records the demonstration of one race in the original and in the port and tallies, per texture, what the original
// drew that the port has no partner for (and the reverse), with the frames, the render state and the screen area.
export const runRenderCoverage = async (
  race: CoverageRace,
  options: CoverageOptions
): Promise<RaceCoverage> => {
  const probe = probeDemonstration(race, options.maximumFrames)
  const recordFrames = getRecordFrames(probe, options)
  const lastFrame = recordFrames[recordFrames.length - 1] ?? 0
  const jam = readOriginalJam()
  const scenario = createPresentationScenario(
    jam,
    getScenarioRequest(race, lastFrame + 1, recordFrames)
  )
  const original = await readOriginalPresentation(scenario)
  const assets = loadScenarioAssets(jam, scenario)
  const stage = createRaceStage(assets, ORIGINAL_STAGE_SIZE)
  const sceneTextures = getSceneTextures(assets)
  const textureRows = new Map<string, TextureAccumulator>()
  const extraRows = new Map<string, GroupAccumulator>()
  const mismatchRows = new Map<string, GroupAccumulator>()
  const portSourcesByTexture = new Map<string, Set<string>>()
  const frameRows: CoverageFrameRow[] = []
  runPortRace(assets, scenario.frames, (portFrame) => {
    const world = compareWorldFrame({
      stage,
      portFrame,
      original,
      sceneTextures,
      candidateCount: CANDIDATE_COUNT,
    })
    if (world === null) return
    const { frame } = portFrame
    const { originalTriangles, portTriangles, textureMatches, comparison } = world
    for (const triangle of portTriangles.triangles) {
      getOrCreate(portSourcesByTexture, triangle.textureKey ?? 'none', () => new Set<string>()).add(
        triangle.source
      )
    }
    const isTrusted = comparison.matchedCount >= MINIMUM_TRUSTED_SHARE * comparison.originalCount
    frameRows.push({
      frame,
      originalCount: comparison.originalCount,
      portCount: comparison.portCount,
      matchedCount: comparison.matchedCount,
      isTrusted,
    })
    if (!isTrusted) return
    const matched = new Set(comparison.matchedOriginals)
    const getTextureName = (triangle: DrawnTriangle) => {
      if (triangle.textureKey === null) return { name: 'none', isInPort: true }
      const best = textureMatches.get(triangle.textureKey)?.bestKey ?? null
      if (best !== null) return { name: best, isInPort: true }
      const texture = original.textures.get(triangle.textureKey)
      return {
        name: `${UNKNOWN_TEXTURE} ${triangle.textureKey} ${String(texture?.width ?? 0)}x${String(texture?.height ?? 0)}`,
        isInPort: false,
      }
    }
    for (const triangle of originalTriangles) {
      const { name, isInPort } = getTextureName(triangle)
      const stateLabel = getStateLabel(triangle.state)
      const row = getOrCreate(textureRows, `${name}|${stateLabel}`, (): TextureAccumulator => ({
        textureName: name,
        isTextureInPort: isInPort,
        stateLabel,
        originalTriangles: 0,
        missingTriangles: 0,
        clippedTriangles: 0,
        missingPixels: 0,
        missingFrames: [],
        missingBounds: null,
        missingDepthRange: null,
      }))
      row.originalTriangles += 1
      if (matched.has(triangle)) continue
      if (
        getIsCutPiece(triangle.vertices, ORIGINAL_STAGE_SIZE, RACE_DEPTH_RANGE) &&
        getIsFragmentOfPolygon(triangle, comparison.clippedPolygons, textureMatches)
      ) {
        row.clippedTriangles += 1
        continue
      }
      row.missingTriangles += 1
      row.missingPixels += getScreenArea(triangle)
      if (row.missingFrames[row.missingFrames.length - 1] !== frame) row.missingFrames.push(frame)
      row.missingBounds = getWidenedBounds(row.missingBounds, triangle)
      row.missingDepthRange = getWidenedDepthRange(row.missingDepthRange, triangle)
    }
    for (const group of comparison.groups) {
      const isExtra = group.kind === 'extra_in_port'
      if (!isExtra && !MISMATCH_KINDS.includes(group.kind)) continue
      const textureName = group.firstPort?.textureKey ?? group.firstOriginal?.textureKey ?? 'none'
      const row = getOrCreate(
        isExtra ? extraRows : mismatchRows,
        `${group.kind}|${group.source}|${textureName}`,
        (): GroupAccumulator => ({
          kind: group.kind,
          source: group.source,
          textureName,
          triangles: 0,
          frames: [],
          firstDetail: group.firstDetail,
          lastDetail: group.firstDetail,
        })
      )
      row.triangles += group.count
      row.frames.push(frame)
      row.lastDetail = group.firstDetail
    }
  })
  const unknownHashes = [...textureRows.values()]
    .map((row) => /^unknown (\w+) /u.exec(row.textureName)?.[1])
    .filter((hash): hash is string => hash !== undefined)
  const jamMatches = matchTextures(
    new Map([...original.textures].filter(([hash]) => unknownHashes.includes(hash))),
    getJamBitmapTextures(jam)
  )
  const getJamName = (textureName: string): string => {
    const hash = /^unknown (\w+) /u.exec(textureName)?.[1]
    const best = hash === undefined ? null : (jamMatches.get(hash)?.bestKey ?? null)
    return best === null ? textureName : `${textureName} (jam: ${best})`
  }
  const textures: readonly CoverageTextureRow[] = [...textureRows.values()]
    .map((row) =>
      Object.freeze({
        ...row,
        textureName: getJamName(row.textureName),
        missingPixels: Math.round(row.missingPixels),
        portSources: [...(portSourcesByTexture.get(row.textureName) ?? [])].slice(0, SOURCE_LIMIT),
      })
    )
    .sort((left, right) => right.missingPixels - left.missingPixels)
  const extras: readonly CoverageExtraRow[] = [...extraRows.values()]
    .map(({ source, textureName, triangles, frames }) => ({
      source,
      textureName,
      triangles,
      frames,
    }))
    .sort((left, right) => right.triangles - left.triangles)
  const mismatches: readonly CoverageMismatchRow[] = [...mismatchRows.values()]
    .map(({ kind, source, triangles, frames, firstDetail, lastDetail }) => ({
      kind,
      source,
      triangles,
      frames,
      firstDetail,
      lastDetail,
    }))
    .sort((left, right) => right.triangles - left.triangles)
  return Object.freeze({
    race,
    probe,
    recordedFrames: recordFrames,
    frames: frameRows,
    textures,
    extras,
    mismatches,
  })
}
