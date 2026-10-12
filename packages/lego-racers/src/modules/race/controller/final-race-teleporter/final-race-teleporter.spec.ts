import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { runTrackLogic } from '../../../track-logic/index.ts'
import { loadRaceDefinition } from '../../services/load-race/load-race.ts'
import type { RaceDefinition, RaceState } from '../../types/race.types.ts'
import { createRace } from '../create-race/create-race.ts'
import { changeTrackLogic, getRaceRacerSet, getRacerSetOf } from '../race-world/race-world.ts'
import { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import { stepRace } from '../step-race/step-race.ts'
import { NO_MENU_INPUT } from '../pause-menu/pause-menu.ts'

const FRAME_MILLISECONDS = 17
const MAXIMUM_FRAMES = 9_000
const WARPING_FLAG = 0x10
const FRAMES_AFTER_WARP = 100
const WAYPOINT_RADIUS = 40
const STEERING_DEAD_ZONE = 0.1
const NO_NEXT_CHECKPOINT = 0xff
const SHOT_DOOR_SIGNAL = 1
// 0x004b4178: where the pad lands the racer.
const DESTINATION = Object.freeze({ x: 132.67, y: 86.3 })
const LANDING_TOLERANCE = 80
// In front of the door, through it, and beyond the "warptrig" plane behind it.
const DOOR_WAYPOINTS: readonly (readonly [number, number])[] = Object.freeze([
  [-165, 257],
  [-150, 249],
  [-130, 238],
  [-100, 220],
])

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

const loadFinalRace = (): RaceDefinition =>
  loadRaceDefinition(readOriginalJam(), readOriginalExecutable(), {
    raceFolder: 'RACEC3R0',
    racerCount: 6,
    localPlayerCount: 1,
    isPlayerChampionCar: true,
    racerCodes: ['RR', 'RR', 'BK', 'AL', 'GS', 'NH'],
    musicTuneCount: 0,
    randomPosition: 2,
  })

// The shot at the door (the "shootme" material) starts signal 1, which opens it.
const getRaceWithDoorShot = (state: RaceState): RaceState => {
  const changed = changeTrackLogic(
    state.context,
    getRaceRacerSet(state, NO_RACE_CONTACTS),
    (trackLogic, trackContext) =>
      runTrackLogic(trackLogic, trackContext, (session) =>
        session.startSignal(SHOT_DOOR_SIGNAL, null)
      )
  )
  return Object.freeze({
    ...state,
    racerSet: getRacerSetOf(changed),
    trackLogic: changed.trackLogic,
    trackEffects: changed.trackEffects,
    surfaces: changed.surfaces,
  })
}

// The checkpoints in link order, then the way through the door.
const getWaypoints = (definition: RaceDefinition): readonly (readonly [number, number])[] => {
  const visited = new Set<number>()
  const checkpoints: (readonly [number, number])[] = []
  for (
    let index: number | undefined = 0;
    index !== undefined && !visited.has(index);
    index = definition.checkpoints[index]?.links[0]
  ) {
    const checkpoint = definition.checkpoints[index]
    if (checkpoint === undefined || index === NO_NEXT_CHECKPOINT) break
    visited.add(index)
    checkpoints.push([checkpoint.point[0], checkpoint.point[1]])
  }
  return [...checkpoints, ...DOOR_WAYPOINTS]
}

describe('the teleporter of the final race (RACEC3R0)', () => {
  // The player drives the route with the opened door in the way: the door's collision object follows the door's bone
  // (event 0x52, 0x004639d0), so the car passes; the "warptrig" plane behind it fires the warp pad (0x0048af80), whose
  // launcher warp (0x0045d560) starts inside the racer's step and lands the car at the pad's destination.
  it.skipIf(!getIsGamePresent())(
    'warps the player who drives through the opened door to the pad destination',
    () => {
      // Arrange
      const definition = loadFinalRace()
      const waypoints = getWaypoints(definition)
      let state = getRaceWithDoorShot(createRace(definition))
      let waypointIndex = 0
      let warpFrame: number | null = null

      // Act
      for (let frame = 0; frame < MAXIMUM_FRAMES && warpFrame === null; frame += 1) {
        const { position, rotation } = state.racerSet.racers[0]?.carBody.rigidBody.displayFrame ?? {
          position: { x: 0, y: 0, z: 0 },
          rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        }
        let target = waypoints[waypointIndex] ?? [0, 0]
        while (
          Math.hypot(target[0] - position.x, target[1] - position.y) < WAYPOINT_RADIUS &&
          waypointIndex < waypoints.length - 1
        ) {
          waypointIndex += 1
          target = waypoints[waypointIndex] ?? target
        }
        const offsetX = target[0] - position.x
        const offsetY = target[1] - position.y
        const cross = rotation[0] * offsetY - rotation[1] * offsetX
        const isOffCourse = Math.abs(cross) > STEERING_DEAD_ZONE * Math.hypot(offsetX, offsetY)
        state = stepRace(
          state,
          {
            controls: [
              {
                ...IDLE_RACER_CONTROLS,
                isAcceleratePressed: true,
                isSteerPositivePressed: isOffCourse && cross > 0,
                isSteerNegativePressed: isOffCourse && cross < 0,
              },
            ],
            contacts: NO_RACE_CONTACTS,
            menu: NO_MENU_INPUT,
          },
          FRAME_MILLISECONDS
        ).raceState
        if (((state.racerSet.racers[0]?.flags ?? 0) & WARPING_FLAG) !== 0) warpFrame = frame
      }
      for (let frame = 0; frame < FRAMES_AFTER_WARP; frame += 1) {
        state = stepRace(
          state,
          { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS, menu: NO_MENU_INPUT },
          FRAME_MILLISECONDS
        ).raceState
      }

      // Assert
      const landed = state.racerSet.racers[0]?.carBody.rigidBody.displayFrame.position
      expect(warpFrame).not.toBeNull()
      expect(
        Math.hypot((landed?.x ?? 0) - DESTINATION.x, (landed?.y ?? 0) - DESTINATION.y)
      ).toBeLessThan(LANDING_TOLERANCE)
    },
    120_000
  )
})
