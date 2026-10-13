import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getGatePartDraws, HazardKeyword, HazardLifecycle } from '../../../hazard/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { STATIC_TRACK_WORLD, updateTrackLogicFrame } from '../../../track-logic/index.ts'
import type { TrackLogicState } from '../../../track-logic/index.ts'
import { loadRaceDefinition } from '../../services/load-race/load-race.ts'
import { createRace } from './create-race.ts'

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

const FRAME_MILLISECONDS = 33
// Long enough for the slowest clip of a gate's parts to play to its end, and some frames after.
const FRAME_COUNT = 400
const OPAQUE_ALPHA = 255
const HAZARD_FILE_PATTERN = /^GAMEDATA\/(RACE[^/]+)\/[^/]+\.HZB$/i

type GateFrame = {
  readonly lifecycle: number
  readonly alphas: readonly number[]
}

const getRaceFoldersWithHazards = (jam: Uint8Array): readonly string[] => [
  ...new Set(
    openJamArchive(jam)
      .getFilePaths()
      .flatMap((path) => {
        const folder = HAZARD_FILE_PATTERN.exec(path.replaceAll('\\', '/'))?.[1]
        return folder === undefined ? [] : [folder.toUpperCase()]
      })
  ),
]

// Opens every gate of the race at once (its identifier is the signal that begins it) and records, frame by frame, the
// gate's lifecycle and the alpha its draw (0x0048f080) gives each part.
const getGateFrames = (folder: string): ReadonlyMap<number, readonly GateFrame[]> => {
  const race = createRace(
    loadRaceDefinition(readOriginalJam(), readOriginalExecutable(), { raceFolder: folder })
  )
  const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
  const context = { arithmetic, world: STATIC_TRACK_WORLD }
  const { racers } = race.racerSet
  const gateIndices = race.trackLogic.hazards.instances.flatMap((hazard, index) =>
    hazard.data.keyword === HazardKeyword.HAZARD_34 ? [index] : []
  )
  const signals = gateIndices.map((index) => ({
    identifier: race.trackLogic.hazards.instances[index]?.identifier ?? 0,
    position: [0, 0, 0] as const,
  }))
  const frames = new Map<number, GateFrame[]>(gateIndices.map((index) => [index, []]))
  Array.from({ length: FRAME_COUNT }).reduce<TrackLogicState>((trackLogic, _, frame) => {
    const step = updateTrackLogicFrame(
      trackLogic,
      context,
      FRAME_MILLISECONDS,
      racers.length,
      frame === 0 ? signals : []
    )
    for (const index of gateIndices) {
      const gate = step.state.hazards.instances[index]
      if (gate === undefined) continue
      const draws = getGatePartDraws(arithmetic, { instances: [gate] }, step.state.worlds)
      frames
        .get(index)
        ?.push({ lifecycle: gate.lifecycle, alphas: draws.map((draw) => draw.alpha) })
    }
    return step.state
  }, race.trackLogic)
  return frames
}

describe.skipIf(!getIsGamePresent())('breakable gates (hazard 0x34) in every race', () => {
  const folders = getIsGamePresent() ? getRaceFoldersWithHazards(readOriginalJam()) : []
  const gateRaces = folders.flatMap((folder) => {
    const frames = getGateFrames(folder)
    return frames.size === 0 ? [] : [{ folder, frames }]
  })

  it('finds the shortcut barrels of the pirate track and the door of the alien track among them', () => {
    // Arrange / Act
    const names = gateRaces.map((race) => race.folder)

    // Assert
    expect(names).toEqual(expect.arrayContaining(['RACEC0R1', 'RACEC2R3']))
  })

  it('keeps drawing the broken pieces while their clip plays, fading from opaque (0x0048f080)', () => {
    // Arrange / Act
    const openings = gateRaces.flatMap(({ folder, frames }) =>
      [...frames.values()].map((gateFrames) => {
        const drawn = gateFrames.filter((frame) => frame.alphas.length > 0)
        return {
          folder,
          drawnFrameCount: drawn.length,
          firstAlpha: drawn[0]?.alphas[0],
          isFading: drawn.every(
            (frame, index) =>
              index === 0 || (frame.alphas[0] ?? 0) <= (drawn[index - 1]?.alphas[0] ?? 0)
          ),
          isDrawnWhileActive: gateFrames.every(
            (frame) => frame.lifecycle === HazardLifecycle.IDLE || frame.alphas.length > 0
          ),
        }
      })
    )

    // Assert: hiding the pieces the moment the gate opens (the world's own distances are 0) fails here
    for (const opening of openings) {
      expect(opening).toMatchObject({
        isFading: true,
        isDrawnWhileActive: true,
      })
      expect(opening.drawnFrameCount, opening.folder).toBeGreaterThan(1)
      expect(opening.firstAlpha, opening.folder).toBeGreaterThan(OPAQUE_ALPHA * 0.9)
    }
  })

  it('stops drawing the pieces once their clip has played, for good', () => {
    // Arrange / Act
    const endings = gateRaces.flatMap(({ folder, frames }) =>
      [...frames.values()].map((gateFrames) => {
        const lastDrawn = gateFrames.findLastIndex((frame) => frame.alphas.length > 0)
        return {
          folder,
          isIdleAtTheEnd: gateFrames.at(-1)?.lifecycle === HazardLifecycle.IDLE,
          framesDrawnAfterwards: gateFrames.slice(lastDrawn + 1).length,
        }
      })
    )

    // Assert: pieces left standing for ever (the gate never idle, or still drawn on the last frame) fail here
    for (const ending of endings) {
      expect(ending.isIdleAtTheEnd, ending.folder).toBe(true)
      expect(ending.framesDrawnAfterwards, ending.folder).toBeGreaterThan(0)
    }
  })
})
