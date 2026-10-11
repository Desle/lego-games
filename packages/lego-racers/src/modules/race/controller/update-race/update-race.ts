import { recordGhostSample } from '../../../ghost/index.ts'
import { advanceSky, switchSkySetting } from '../../../sky/index.ts'
import { updateTrackHazardsAfterRacers, updateTrackLogicFrame } from '../../../track-logic/index.ts'
import { advanceWorldAnimation } from '../../../world-animation/index.ts'
import { updatePowerUpsWithProjectiles } from '../../../projectiles/index.ts'
import type { ProjectileWorld } from '../../../projectiles/index.ts'
import { getRacerSetWithProjectileRegistry } from '../projectile-registry/projectile-registry.ts'
import { getRaceTimeStep, updateRacePhysics } from '../../../racer-physics/index.ts'
import { applyRacerControls, stepRacerSet, updatePlayerController } from '../../../racer/index.ts'
import type { RaceInputs, RaceRacerSet, RaceState } from '../../types/race.types.ts'
import {
  RACE_PLAYER_CONTROLLER_DEPENDENCIES,
  RACE_STEP_DEPENDENCIES,
} from '../race-dependencies/race-dependencies.ts'
import {
  changePowerUps,
  changeTrackLogic,
  getProjectileContext,
  getRacerSetAfterProjectileEvents,
  getRaceRacerSet,
  getRaceRacerSetOf,
  getRacerSetOf,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  updateTaggedPositions,
} from '../race-world/race-world.ts'
import type { PlayerControllerProgress, PlayerControllerRun } from './update-race.types.ts'

// Race settings +0x20 bit 0x100 scales the time by 1.75.
const TIME_SCALE_FLAG = 0x100
// Race_Update 0x00435220: race +0x334c becomes 1,000 when the time step exceeds it.
const COUNTDOWN_RESET_MILLISECONDS = 1000

// Sky_Update 0x0041ccb0, the last world update of Race_Update: the setting the 42 events switched to (0x0041d150)
// is current, the background world animates and the sky's settings advance.
const getStateWithSkyUpdated = (state: RaceState, milliseconds: number): RaceState => {
  if (state.sky === null) return state
  const switched = state.trackEffects.reduce(
    (skyState, effect) =>
      effect.type === 'track.sky_setting_switched'
        ? switchSkySetting(skyState, effect.name, effect.durationMilliseconds)
        : skyState,
    state.sky.state
  )
  return Object.freeze({
    ...state,
    sky: Object.freeze({
      state: advanceSky(switched, milliseconds),
      background: advanceWorldAnimation(state.sky.background, milliseconds),
    }),
  })
}

export const getIsTimeScaled = (state: RaceState): boolean =>
  (state.raceModeFlags & TIME_SCALE_FLAG) !== 0

// Runs one controller function for every local player, in order, against the racer set the players drive.
const runPlayerControllers = (
  state: RaceState,
  racerSet: RaceRacerSet,
  run: PlayerControllerRun
): PlayerControllerProgress =>
  state.playerRacerIndices.reduce<PlayerControllerProgress>(
    (progress, racerIndex, playerIndex) => {
      const controller = progress.controllers[playerIndex]
      if (controller === undefined) return progress
      const next = run(
        {
          context: state.context,
          state: { controller, racerSet: progress.racerSet },
          racerIndex,
          dependencies: RACE_PLAYER_CONTROLLER_DEPENDENCIES,
        },
        playerIndex
      )
      return {
        controllers: Object.freeze(
          progress.controllers.map((candidate, index) =>
            index === playerIndex ? next.controller : candidate
          )
        ),
        racerSet: getRaceRacerSetOf(next.racerSet),
      }
    },
    { controllers: state.playerControllers, racerSet }
  )

const getStateWithProgress = (state: RaceState, progress: PlayerControllerProgress): RaceState =>
  Object.freeze({
    ...state,
    racerSet: getRacerSetOf(progress.racerSet),
    powerUpStep: progress.racerSet.powerUpStep,
    projectileWorld: progress.racerSet.projectileWorld,
    registryObjects: progress.racerSet.registryObjects,
    trackLogic: progress.racerSet.trackLogic,
    trackEffects: progress.racerSet.trackEffects,
    taggedPositionMilliseconds: progress.racerSet.taggedPositionMilliseconds,
    playerControllers: progress.controllers,
  })

// The device callbacks 0x004309c0: the bindings pressed or released since the last frame.
export const applyPlayerControls = (state: RaceState, inputs: RaceInputs): RaceState =>
  getStateWithProgress(
    state,
    runPlayerControllers(state, getRaceRacerSet(state, NO_RACE_CONTACTS), (input, playerIndex) =>
      applyRacerControls(input, inputs.controls[playerIndex] ?? IDLE_RACER_CONTROLS)
    )
  )

// The hazards that follow the cameras (0x0048ae00) are given the players' camera positions; the port keeps no camera
// in the simulation, so none.
const NO_CAMERA_POSITIONS: readonly (readonly [number, number, number])[] = Object.freeze([])

// Race_Update 0x00435220: the frame's whole time step goes to the power-ups and the players' controllers, then
// the racers run in sub-steps of at most 40 ms; the worlds, triggers, emitters, events, hazards and timers run
// first (track-logic) and the hazards that follow the cameras and the sky at the end. Not ported: the tagged
// positions (0x0045e470), the lists 0x00493a20, 0x00492870 and 0x00494f60 and the HUD; the cameras (0x00428540) and
// the ghost recorder (0x00422710) only read the racers.
export const updateRace = (
  state: RaceState,
  inputs: RaceInputs,
  frameMilliseconds: number
): RaceState => {
  const { arithmetic } = state.context
  const timeInput = {
    frameDeltaMilliseconds: frameMilliseconds,
    isTimeScaled: getIsTimeScaled(state),
  }
  const stepMilliseconds = getRaceTimeStep(arithmetic, timeInput)
  const counted: RaceState = Object.freeze({
    ...state,
    unidentifiedCountdownMilliseconds:
      state.unidentifiedCountdownMilliseconds < stepMilliseconds
        ? COUNTDOWN_RESET_MILLISECONDS
        : state.unidentifiedCountdownMilliseconds - stepMilliseconds,
  })
  const poweredSet = getRaceRacerSet(counted, inputs.contacts)
  let projectileWorld: ProjectileWorld = counted.projectileWorld
  const changed = changePowerUps(counted.context, poweredSet, (step, powerUpContext) => {
    const projected = updatePowerUpsWithProjectiles(
      step,
      counted.projectileWorld,
      getProjectileContext(counted, poweredSet, powerUpContext),
      stepMilliseconds
    )
    projectileWorld = projected.world
    return projected.step
  })
  const projected = getRacerSetWithProjectileRegistry(
    arithmetic,
    getRacerSetAfterProjectileEvents(
      arithmetic,
      Object.freeze({ ...changed, projectileWorld }),
      projectileWorld.events
    )
  )
  const tagged = updateTaggedPositions(projected, stepMilliseconds)
  const powered = changeTrackLogic(counted.context, tagged, (trackLogic, trackContext) =>
    updateTrackLogicFrame(trackLogic, trackContext, stepMilliseconds, tagged.racers.length)
  )
  const controlled = counted.isDemonstration
    ? { controllers: counted.playerControllers, racerSet: powered }
    : runPlayerControllers(counted, powered, (input, playerIndex) =>
        updatePlayerController(
          input,
          inputs.controls[playerIndex] ?? IDLE_RACER_CONTROLS,
          stepMilliseconds
        )
      )
  const ghostRacerIndex = counted.playerRacerIndices[0]
  let ghost = counted.ghost
  const stepped = updateRacePhysics(
    arithmetic,
    controlled.racerSet,
    timeInput,
    (racerSet, subStepMilliseconds) => {
      const steppedSet = getRaceRacerSetOf(
        stepRacerSet({
          context: counted.context,
          racerSet,
          stepMilliseconds: subStepMilliseconds,
          dependencies: RACE_STEP_DEPENDENCIES,
        })
      )
      const ghostRacer =
        ghostRacerIndex === undefined ? undefined : steppedSet.racers[ghostRacerIndex]
      if (ghost !== null && ghostRacer !== undefined) {
        const { position, rotation } = ghostRacer.carBody.rigidBody.displayFrame
        ghost = recordGhostSample(arithmetic, ghost, subStepMilliseconds, { position, rotation })
      }
      return steppedSet
    }
  )
  const hazardsFollowed = changeTrackLogic(counted.context, stepped, (trackLogic, trackContext) =>
    updateTrackHazardsAfterRacers(trackLogic, trackContext, NO_CAMERA_POSITIONS)
  )
  const progressed = Object.freeze({
    ...getStateWithProgress(Object.freeze({ ...counted, projectileWorld }), {
      controllers: controlled.controllers,
      racerSet: hazardsFollowed,
    }),
    ghost,
  })
  return getStateWithSkyUpdated(progressed, stepMilliseconds)
}
