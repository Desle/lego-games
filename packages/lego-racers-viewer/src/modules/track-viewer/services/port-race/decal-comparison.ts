import { createDecalFrame, projectDecal } from '@lego-games/lego-racers/decal'
import type { DecalTriangle } from '@lego-games/lego-racers/decal'
import { readOriginalPresentation } from '@lego-games/lego-racers/presentation-trace'
import type { OriginalDecal } from '@lego-games/lego-racers/presentation-trace'
import { getEffectViews } from '@lego-games/lego-racers/race-presentation'
import { getDecalSurface } from '../race-decals/race-decals.ts'
import { readOriginalJam } from './original-game-files.ts'
import { runPortRace } from './port-race.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'
import type { DecalFrameComparison, PortDecal } from './decal-comparison.types.ts'

// The addresses 0x00414a30 is called from: the oil slick (0x004573a0) and an explosion's scar (0x00421850, growing and
// at the end of the growth).
const OIL_SLICK_SOURCES: readonly number[] = [0x004575a3]
const EXPLOSION_SCAR_SOURCES: readonly number[] = [0x004218f5, 0x004219c9]
const IMAGE_SOURCES: Readonly<Record<string, readonly number[]>> = Object.freeze({
  oilslck: OIL_SLICK_SOURCES,
  exscar: EXPLOSION_SCAR_SOURCES,
})
const TOLERANCE = 0.001

// 0x00421ae0: a growing burst's scar is drawn at 180, a fading one at its alpha truncated.
const GROWING_STATE = 2
const GROWING_SCAR_ALPHA = 180

const getOriginalAlpha = (decal: OriginalDecal): number =>
  decal.ownerState === GROWING_STATE ? GROWING_SCAR_ALPHA : Math.trunc(decal.ownerAlpha)

const getAreEqual = (
  original: OriginalDecal['triangles'],
  port: readonly DecalTriangle[]
): boolean =>
  original.length === port.length &&
  original.every((triangle, triangleIndex) =>
    triangle.every((corner, cornerIndex) => {
      const vertex = port[triangleIndex]?.[cornerIndex]
      return (
        vertex !== undefined &&
        [vertex.x, vertex.y, vertex.z, vertex.u, vertex.v].every(
          (value, valueIndex) => Math.abs(value - (corner[valueIndex] ?? Infinity)) <= TOLERANCE
        )
      )
    })
  )

// Runs the original and the port through a scenario and compares, on every recorded frame, the triangles of the oil
// slicks and the explosion scars: the original's decal objects after their projections (whether or not the camera sees
// them) against the port's projection of the decal views.
export const runDecalComparison = async (
  request: TraceScenarioRequest
): Promise<readonly DecalFrameComparison[]> => {
  const jam = readOriginalJam()
  const scenario = createPresentationScenario(jam, {
    ...request,
    isRenderRecorded: false,
    isDecalRecorded: true,
  })
  const original = await readOriginalPresentation(scenario)
  const assets = loadScenarioAssets(jam, scenario)
  const surface = getDecalSurface(assets.scene, scenario.isMirrored)
  const portDecals = new Map<number, readonly PortDecal[]>()
  runPortRace(
    assets,
    scenario.frames,
    ({ frame, raceState }) => {
      if (surface === null || !(scenario.recordFrames?.includes(frame) ?? true)) return
      portDecals.set(
        frame,
        getEffectViews(raceState).decals.map((view) => ({
          imageName: view.imageName,
          alpha: view.alpha,
          triangles: projectDecal(surface.world, createDecalFrame(view.placement), view.limits),
        }))
      )
    },
    scenario.powerUpGrants ?? []
  )
  return original.decalFrames.map((decalFrame): DecalFrameComparison => {
    const unused = decalFrame.decals.filter((decal) =>
      Object.values(IMAGE_SOURCES).some((sources) => sources.includes(decal.source))
    )
    const port = portDecals.get(decalFrame.frame) ?? []
    let matchedCount = 0
    for (const decal of port) {
      const index = unused.findIndex(
        (candidate) =>
          (IMAGE_SOURCES[decal.imageName] ?? []).includes(candidate.source) &&
          getAreEqual(candidate.triangles, decal.triangles) &&
          (decal.alpha === null || decal.alpha === getOriginalAlpha(candidate))
      )
      if (index === -1) continue
      matchedCount += 1
      unused.splice(index, 1)
    }
    return {
      frame: decalFrame.frame,
      portCount: port.length,
      matchedCount,
      unmatchedOriginals: unused.map(
        (decal) => `${decal.source.toString(16)} x${String(decal.triangles.length)}`
      ),
    }
  })
}
