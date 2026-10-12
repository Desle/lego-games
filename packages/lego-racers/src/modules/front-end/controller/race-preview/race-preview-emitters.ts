import { getActiveCinemaDummies } from '../../../cinema/index.ts'
import type { Cinema, CinemaDummy } from '../../../cinema/index.ts'
import {
  createEmitterPool,
  releaseEmitter,
  spawnEmitter,
  updateEmitterPool,
} from '../../../emitter/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  RacePreviewEmittersInput,
  RacePreviewDummyStart,
  RacePreviewEmittersStep,
  RacePreviewStartedPool,
  RacePreviewResources,
  RacePreviewStartedEmitter,
} from '../../types/race-preview.types.ts'

// FUN_004a1240: the cinema's pool holds 3 emitters.
const POOL_INSTANCE_COUNT = 3
const START_LIST_KEYWORD = 0x56
const EMITTER_EVENT_KEYWORD = 0x3c

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

const getEmitterEventName = (resources: RacePreviewResources, dummyName: string): string | null =>
  resources.events.reactionLists
    .find((list) => list.listKeyword === START_LIST_KEYWORD)
    ?.starts.find(
      (reaction) =>
        reaction.entryName.toLowerCase() === dummyName.toLowerCase() &&
        reaction.targetKeyword === EMITTER_EVENT_KEYWORD
    )?.targetName ?? null

const getDummyPlacement = (dummy: CinemaDummy) =>
  Object.freeze({
    position: { x: dummy.position[0], y: dummy.position[1], z: dummy.position[2] },
    orientation: {
      facing: { x: dummy.forward[0], y: dummy.forward[1], z: dummy.forward[2] },
      up: { x: dummy.up[0], y: dummy.up[1], z: dummy.up[2] },
    },
  })

// FUN_004a3c90: an emitter event spawns its emitter at the bound dummy's position, facing along the dummy's frame.
const startDummy = (
  resources: RacePreviewResources,
  cinema: Cinema,
  pool: EmitterPool,
  dummyIndex: number
): RacePreviewDummyStart => {
  const dummy = cinema.dummies[dummyIndex]
  const eventName = dummy === undefined ? null : getEmitterEventName(resources, dummy.name)
  const event = resources.events.emitterEvents.find(
    (candidate) => candidate.name.toLowerCase() === eventName?.toLowerCase()
  )
  if (dummy === undefined || event === undefined) return { pool, started: null }
  const spawn = spawnEmitter(arithmetic, pool, event.emitterName, getDummyPlacement(dummy))
  return { pool: spawn.pool, started: { dummyIndex, handleIndex: spawn.handleIndex } }
}

const getStartedPool = (
  resources: RacePreviewResources,
  cinema: Cinema,
  pool: EmitterPool,
  started: readonly RacePreviewStartedEmitter[],
  milliseconds: number
): RacePreviewStartedPool => {
  const onIndices = getActiveCinemaDummies(cinema, milliseconds).map((dummy) =>
    cinema.dummies.indexOf(dummy)
  )
  let current = pool
  const next: RacePreviewStartedEmitter[] = []
  for (const entry of started) {
    if (onIndices.includes(entry.dummyIndex)) next.push(entry)
    else if (entry.handleIndex !== null) current = releaseEmitter(current, entry.handleIndex)
  }
  for (const dummyIndex of onIndices) {
    if (next.some((entry) => entry.dummyIndex === dummyIndex)) continue
    const result = startDummy(resources, cinema, current, dummyIndex)
    current = result.pool
    if (result.started !== null) next.push(result.started)
  }
  return { pool: current, started: Object.freeze(next) }
}

const getLoopCount = (cinema: Cinema, milliseconds: number): number =>
  cinema.framesPerSecond === 0 || cinema.lengthFrames === 0
    ? 0
    : Math.floor(milliseconds / ((cinema.lengthFrames * 1000) / cinema.framesPerSecond))

// Cinema_Update 0x00466d90 and the switch 0x00466d00: a frame updates the cinema (the timeline starts and stops the emitters
// of the dummies, then the pool steps by the frame's time, drawing from the random table); a switch updates the old pool,
// lets it go (every emitter vanishes, FUN_004a3dd0) and starts the new cinema's dummies at its frame 0, and the new pool
// steps in the same frame (measured: the particles' places match the original's to a pixel from the first frame).
export const advanceRacePreviewEmitters = (
  input: RacePreviewEmittersInput
): RacePreviewEmittersStep => {
  const { resources, cinema, random } = input
  let position = random.position
  const step = (pool: EmitterPool): EmitterPool => {
    const update = updateEmitterPool(
      arithmetic,
      pool,
      { table: random.table, position },
      input.frameMilliseconds
    )
    position = update.position
    return update.pool
  }
  const poolFiles = resources.pools[0]
  const isSame = input.previous !== null && input.previous.cinemaName === cinema?.name
  if (input.previous !== null && (!isSame || input.isRestarted)) step(input.previous.pool)
  if (cinema === null || poolFiles === undefined)
    return { emitters: null, randomPosition: position }
  if (input.previous !== null && isSame && !input.isRestarted) {
    const isLooped =
      getLoopCount(cinema, input.milliseconds) !== getLoopCount(cinema, input.previousMilliseconds)
    const started = getStartedPool(
      resources,
      cinema,
      input.previous.pool,
      isLooped ? [] : input.previous.started,
      input.milliseconds
    )
    return {
      emitters: Object.freeze({
        cinemaName: cinema.name,
        pool: step(started.pool),
        started: started.started,
      }),
      randomPosition: position,
    }
  }
  const fresh = createEmitterPool({
    list: poolFiles.emitters,
    instanceCount: POOL_INSTANCE_COUNT,
    animation: poolFiles.animation,
  })
  const started = getStartedPool(resources, cinema, fresh, [], 0)
  return {
    emitters: Object.freeze({
      cinemaName: cinema.name,
      pool: step(started.pool),
      started: started.started,
    }),
    randomPosition: position,
  }
}
