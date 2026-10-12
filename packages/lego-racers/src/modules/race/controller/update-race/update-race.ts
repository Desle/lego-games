import type { Vector3 } from '../../../simulation-math/index.ts'
import { recordGhostSample } from '../../../ghost/index.ts'
import { advanceSky, switchSkySetting } from '../../../sky/index.ts'
import {
  followTrackCameras,
  updateTrackHazardsAfterRacers,
  updateTrackLogicFrame,
} from '../../../track-logic/index.ts'
import type { SurfaceSignal } from '../../../track-logic/index.ts'
import { advanceWorldAnimation } from '../../../world-animation/index.ts'
import { updatePowerUpsWithProjectiles } from '../../../projectiles/index.ts'
import type { ProjectileWorld } from '../../../projectiles/index.ts'
import { getRacerSetWithProjectileRegistry } from '../projectile-registry/projectile-registry.ts'
import { getRaceTimeStep, updateRacePhysics } from '../../../racer-physics/index.ts'
import {
  applyRacerControls,
  releaseAllBindings,
  stepRacerSet,
  updatePlayerController,
} from '../../../racer/index.ts'
import type { RaceInputs, RaceRacerSet, RaceState } from '../../types/race.types.ts'
import {
  RACE_PLAYER_CONTROLLER_DEPENDENCIES,
  RACE_STEP_DEPENDENCIES,
} from '../race-dependencies/race-dependencies.ts'
import {
  changePowerUps,
  changeTrackLogic,
  getContextWithMovedCollisionObjects,
  getProjectileContext,
  getRacerSetAfterProjectileEvents,
  getRaceRacerSet,
  getRaceRacerSetOf,
  getRacerSetOf,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  updateTaggedPositions,
} from '../race-world/race-world.ts'
import {
  getCameraFovEffectWithWarp,
  stepCameraFovEffect,
} from '../camera-fov-effect/camera-fov-effect.ts'
import { getStateWithWarpsDrawn } from '../warp-draw/warp-draw.ts'
import { getScreenFaderAfterUpdate, getWarpStates } from '../warp-fade/warp-fade.ts'
import type { PlayerControllerProgress, PlayerControllerRun } from './update-race.types.ts'

// Race settings +0x20 bit 0x100 scales the time by 1.75.
const TIME_SCALE_FLAG = 0x100
// The camera half of 0x0048ae00, once the frame's camera is known (the port keeps its cameras in the presentation): the
// hazards that follow the camera, the snow, place themselves at it. The first local player's camera is the one given.
export const getRaceWithHazardsAtCamera = (
  state: RaceState,
  camera: { readonly position: Vector3; readonly forward: Vector3; readonly up: Vector3 }
): RaceState =>
  getStateWithProgress(state, {
    controllers: state.playerControllers,
    racerSet: changeTrackLogic(
      state.context,
      getRaceRacerSet(state, NO_RACE_CONTACTS),
      (trackLogic, trackContext) =>
        followTrackCameras(trackLogic, trackContext, [
          { position: camera.position, forward: camera.forward, second: camera.up },
        ])
    ),
  })

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
    surfaces: progress.racerSet.surfaces,
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

// 0x00430c20 for every local player (the pause menu opens): each binding is released, held or not.
export const releasePlayerControls = (state: RaceState): RaceState =>
  getStateWithProgress(
    state,
    runPlayerControllers(state, getRaceRacerSet(state, NO_RACE_CONTACTS), releaseAllBindings)
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
  const surfaceSignals: SurfaceSignal[] = []
  const changed = changePowerUps(counted.context, poweredSet, (step, powerUpContext) => {
    const projected = updatePowerUpsWithProjectiles(
      step,
      counted.projectileWorld,
      getProjectileContext(counted, poweredSet, powerUpContext, (identifier, point) =>
        surfaceSignals.push({ identifier, position: [point.x, point.y, point.z] })
      ),
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
  // The hazards the events began register at once (their Begin calls 0x0042fb50).
  const powered = getRacerSetWithProjectileRegistry(
    arithmetic,
    changeTrackLogic(counted.context, tagged, (trackLogic, trackContext) =>
      updateTrackLogicFrame(
        trackLogic,
        trackContext,
        stepMilliseconds,
        tagged.racers.length,
        surfaceSignals
      )
    )
  )
  const framed: RaceState = Object.freeze({
    ...counted,
    context: getContextWithMovedCollisionObjects(
      counted.context,
      powered.collisionObjectNames,
      powered.trackEffects.slice(tagged.trackEffects.length)
    ),
  })
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
  let cameraFovEffects = counted.cameraFovEffects
  const stepped = updateRacePhysics(
    arithmetic,
    controlled.racerSet,
    timeInput,
    (racerSet, subStepMilliseconds) => {
      const steppedSet = getRaceRacerSetOf(
        stepRacerSet({
          context: framed.context,
          racerSet,
          stepMilliseconds: subStepMilliseconds,
          dependencies: RACE_STEP_DEPENDENCIES,
        })
      )
      // Race_Update then updates each local player's camera; its field-of-view effect draws from the random table.
      const camerasStepped = counted.playerRacerIndices.reduce(
        (current, racerIndex, playerIndex) => {
          const effect = cameraFovEffects[playerIndex]
          const racer = current.racers[racerIndex]
          if (effect === undefined || racer === undefined) return current
          const warpStates = getWarpStates(racerSet.powerUpStep, racerIndex)
          const step = stepCameraFovEffect(
            arithmetic,
            counted.context.tables.randomTable,
            current.randomPosition,
            getCameraFovEffectWithWarp(effect, warpStates.isStarting, warpStates.isCarrying),
            racer.flags,
            Math.trunc(subStepMilliseconds)
          )
          cameraFovEffects = Object.freeze(
            cameraFovEffects.map((candidate, index) =>
              index === playerIndex ? step.effect : candidate
            )
          )
          return Object.freeze({ ...current, randomPosition: step.position })
        },
        steppedSet
      )
      const ghostRacer =
        ghostRacerIndex === undefined ? undefined : camerasStepped.racers[ghostRacerIndex]
      if (ghost !== null && ghostRacer !== undefined) {
        const { position, rotation } = ghostRacer.carBody.rigidBody.displayFrame
        ghost = recordGhostSample(arithmetic, ghost, subStepMilliseconds, { position, rotation })
      }
      return camerasStepped
    }
  )
  // A racer's use of a power-up (0x00439100, after the vehicle update) can take an effect over, whose reset ends its
  // registry entry at once.
  const hazardsFollowed = getRacerSetWithProjectileRegistry(
    arithmetic,
    changeTrackLogic(counted.context, stepped, (trackLogic, trackContext) =>
      updateTrackHazardsAfterRacers(trackLogic, trackContext, NO_CAMERA_POSITIONS)
    )
  )
  const progressed = Object.freeze({
    ...getStateWithProgress(Object.freeze({ ...framed, projectileWorld }), {
      controllers: controlled.controllers,
      racerSet: hazardsFollowed,
    }),
    ghost,
    cameraFovEffects,
    screenFader: getScreenFaderAfterUpdate(counted, stepMilliseconds),
  })
  return getStateWithWarpsDrawn(getStateWithSkyUpdated(progressed, stepMilliseconds))
}
