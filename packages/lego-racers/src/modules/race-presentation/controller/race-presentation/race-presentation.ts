import { getIntroductionCameraView } from '../get-introduction-camera-view/get-introduction-camera-view.ts'
import { getWarpView } from '../get-warp-view/get-warp-view.ts'
import { getScreenFadeViews } from '../get-screen-fade-views/get-screen-fade-views.ts'
import { getPhysicsSubSteps, getRaceTimeStep } from '../../../racer-physics/index.ts'
import {
  attachCamera,
  createCamera,
  FINISH_CAMERA_NUMBER,
  getCameraRacerView,
  getCameraView,
  PLAYER_CAMERA_COUNT,
  requestCameraSnap,
  setCameraLookingBehind,
  setCameraPreset,
  updateCamera,
} from '../../../race-camera/index.ts'
import type { CameraState } from '../../../race-camera/index.ts'
import {
  getCountdownSound,
  getIntroductionMusic,
  getNearestRacerSound,
  getPowerSlideSound,
  getRaceEventLoops,
  getRaceEventSounds,
  getTuneMusic,
  getSkidStartSound,
  INITIAL_ENGINE_SOUND_STATE,
  stepEngineSounds,
} from '../../../race-audio/index.ts'
import type {
  EngineSoundState,
  RaceSoundContext,
  SoundListener,
  SoundRequest,
} from '../../../race-audio/index.ts'
import {
  createHudState,
  finishHud,
  getHudFrame,
  startHudCountdown,
} from '../../../race-hud/index.ts'
import type { HudFrame, HudMinimap, HudRacerView } from '../../../race-hud/index.ts'
import { INITIAL_FIELD_OF_VIEW_DEGREES, RacePhase } from '../../../race/index.ts'
import type { RaceState, RaceStepResult } from '../../../race/index.ts'
import { getRacer } from '../../../racer/index.ts'
import type { Racer, RacerControls } from '../../../racer/index.ts'
import type {
  HudContext,
  PresentationEdits,
  RacePresentation,
  RacePresentationFrame,
  RacePresentationStart,
} from '../../types/race-presentation.types.ts'

// Race flag settings +0x20 bit 0x100: the 1.75× time scale (Race_Update 0x00435220).
const TIME_SCALE_FLAG = 0x100
// Racer flags (+0xd04): 0x10 warping, 0x80 power sliding, 0x4000 going the wrong way.
const WARPING_FLAG = 0x10
const POWER_SLIDING_FLAG = 0x80
const WRONG_WAY_FLAG = 0x4000
// Racer flags 0x400 (the engine sounds run) and 0x1000 (they are quieter), driver flag 0x1 (full throttle).
const RACER_RUNNING_FLAG = 0x400
const RACER_QUIET_FLAG = 0x1000
const DRIVER_FULL_THROTTLE_FLAG = 0x1
// Racer +0xd08 = 2: a computer drives it.
const COMPUTER_CONTROLLER = 2
// The countdown and racing and finishing states draw the HUD (Race_Render 0x004354d0 calls slot +0x40 in 2..4).
const HUD_PHASES: readonly string[] = [RacePhase.COUNTDOWN, RacePhase.RACING, RacePhase.FINISHING]

const getPlayerRacer = (raceState: RaceState, playerRacerIndex: number): Racer =>
  getRacer(raceState.racerSet, playerRacerIndex)

// The listener: the racer's position and the axis to its left in the plane (its forward row's x and y, normalized and
// turned a quarter turn; a car pointing straight up or down faces along x).
const getSoundListener = (racer: Racer): SoundListener => {
  const { position, rotation } = racer.carBody.rigidBody.displayFrame
  const forwardX = rotation[0]
  const forwardY = rotation[1]
  const length = Math.hypot(forwardX, forwardY)
  return Object.freeze({
    position,
    left: Object.freeze(
      length === 0 ? { x: 0, y: 1, z: 0 } : { x: -forwardY / length, y: forwardX / length, z: 0 }
    ),
  })
}

// Race_LoadTrackContent 0x00433480: the camera attaches to the player's racer and the introduction music starts.
export const createRacePresentation = (
  raceState: RaceState,
  musicListCount: number,
  playerRacerIndex = raceState.playerRacerIndices[0] ?? 0
): RacePresentationStart => {
  const racer = getPlayerRacer(raceState, playerRacerIndex)
  return Object.freeze({
    presentation: Object.freeze({
      playerRacerIndex,
      musicListCount,
      camera: attachCamera(createCamera(), getCameraRacerView(racer, 0)),
      hud: createHudState(),
      turboLevel: 0,
      cameraNumber: 0,
      isCameraSwitchEnabled: false,
      previousPhase: raceState.phase,
      isChangeCameraHeld: false,
      isWarpDrawn: false,
      isPlayerPowerSliding: false,
      engineSounds: Object.freeze(raceState.racerSet.racers.map(() => INITIAL_ENGINE_SOUND_STATE)),
    }),
    music: getIntroductionMusic(),
  })
}

const getHudRacerView = (raceState: RaceState, racerIndex: number): HudRacerView => {
  const racer = getPlayerRacer(raceState, racerIndex)
  const powerUpRacer = raceState.powerUpStep.world.racers[racerIndex]
  return Object.freeze({
    currentLap: racer.currentLap,
    lapCount: racer.lapCount,
    lapMilliseconds: racer.lapMilliseconds,
    racePosition: racer.racePosition,
    isWrongWay: (racer.flags & WRONG_WAY_FLAG) !== 0,
    isWarping: (racer.flags & WARPING_FLAG) !== 0,
    heldPowerUp: Object.freeze({
      kindCode: racer.heldPowerUp,
      level: powerUpRacer?.enhancementLevel ?? 0,
    }),
  })
}

// What the minimap reads (0x004249b0): every racer's display frame position and who drives it, and the way the player points.
const getHudMinimap = (
  raceState: RaceState,
  playerIndex: number,
  hudContext: HudContext
): HudMinimap | null => {
  if (hudContext.displayBounds === null) return null
  const racers = raceState.racerSet.racers
  const own = racers[playerIndex]
  if (own === undefined) return null
  const { rotation } = own.carBody.rigidBody.displayFrame
  return Object.freeze({
    displayBounds: hudContext.displayBounds,
    isMirrored: hudContext.isMirrored,
    mapImageName: hudContext.mapImageName,
    racers: Object.freeze(
      racers.map((racer) =>
        Object.freeze({
          position: racer.carBody.rigidBody.displayFrame.position,
          isComputer: racer.controllerKind === COMPUTER_CONTROLLER,
        })
      )
    ),
    ownIndex: playerIndex,
    ownHeading: Object.freeze({ x: rotation[0], y: rotation[1] }),
  })
}

// The turbo level the camera reads (racer +0xd68), set by the power-up event that starts a turbo.
const getTurboLevel = (step: RaceStepResult, playerRacerIndex: number, current: number): number =>
  step.events.reduce((level, event) => {
    if (event.type !== 'race.power_up') return level
    const powerUpEvent = event.event
    return powerUpEvent.type === 'power_ups.racer_turbo_started' &&
      powerUpEvent.racer === playerRacerIndex
      ? powerUpEvent.level
      : level
  }, current)

// What the frame's race events change (Race_UpdateState1 0x004349a0 → 0x0043a360 and 0x00426360, Race_UpdateState2
// 0x00434b00 for the music, Race_UpdateState3 0x00434c80 → 0x00426370, 0x004283f0 and the finish music).
const getEditsForEvents = (
  presentation: RacePresentation,
  step: RaceStepResult
): PresentationEdits => {
  const { raceState } = step
  return step.events.reduce<PresentationEdits>(
    (edits, event) => {
      if (event.type === 'race.phase_changed' && event.to === RacePhase.COUNTDOWN) {
        return {
          ...edits,
          camera: requestCameraSnap(setCameraPreset(edits.camera, edits.cameraNumber, false)),
          hud: startHudCountdown(edits.hud),
          isCameraSwitchEnabled: true,
        }
      }
      if (event.type === 'race.tune_changed') {
        return { ...edits, music: getTuneMusic(event.tuneIndex) }
      }
      if (
        event.type === 'race.racer_finished' &&
        event.racerIndex === presentation.playerRacerIndex
      ) {
        return {
          ...edits,
          camera: setCameraPreset(edits.camera, FINISH_CAMERA_NUMBER, raceState.isMultiplayer),
          hud: finishHud(edits.hud, event.place),
          isCameraSwitchEnabled: false,
        }
      }
      return edits
    },
    {
      camera: presentation.camera,
      hud: presentation.hud,
      cameraNumber: presentation.cameraNumber,
      isCameraSwitchEnabled: presentation.isCameraSwitchEnabled,
      music: null,
    }
  )
}

// Race_Update 0x00435220 updates each local player's camera after every physics sub-step; the sub-steps are the
// frame's time step in pieces of at most 40 ms. Only the state after the last sub-step is known here, so every
// sub-step sees it.
const getUpdatedCamera = (
  camera: CameraState,
  raceState: RaceState,
  presentation: RacePresentation,
  frameMilliseconds: number
) => {
  const introductionView = getIntroductionCameraView(raceState)
  if (introductionView !== null) return { camera, view: introductionView }
  const racer = getPlayerRacer(raceState, presentation.playerRacerIndex)
  const timeStep = getRaceTimeStep(raceState.context.arithmetic, {
    isTimeScaled: (raceState.raceModeFlags & TIME_SCALE_FLAG) !== 0,
    frameDeltaMilliseconds: frameMilliseconds,
  })
  const racerView = getCameraRacerView(racer, presentation.turboLevel)
  return getPhysicsSubSteps(timeStep).reduce(
    (update, subStep) => updateCamera(update.camera, racerView, subStep),
    { camera, view: getCameraView(camera) }
  )
}

// 0x00437d40 for every racer after every physics sub-step (RacerSet_Step); only the state after the last sub-step is
// known here, so every sub-step sees it.
const getEngineSounds = (
  raceState: RaceState,
  engineSounds: readonly EngineSoundState[],
  frameMilliseconds: number,
  soundRacerIndices: readonly number[]
) => {
  const timeStep = getRaceTimeStep(raceState.context.arithmetic, {
    isTimeScaled: (raceState.raceModeFlags & TIME_SCALE_FLAG) !== 0,
    frameDeltaMilliseconds: frameMilliseconds,
  })
  const subSteps = getPhysicsSubSteps(timeStep)
  const steps = raceState.racerSet.racers.map((racer, racerIndex) => {
    const { rigidBody } = racer.carBody
    const { displayFrame } = rigidBody
    const input = {
      isRunning: (racer.flags & RACER_RUNNING_FLAG) !== 0,
      isQuiet: (racer.flags & RACER_QUIET_FLAG) !== 0,
      isDriverThrottling: (racer.driver.flags & DRIVER_FULL_THROTTLE_FLAG) !== 0,
      throttle: rigidBody.throttle,
      speed: rigidBody.speed,
      forwardSpeed: rigidBody.forwardSpeed,
      airborneMilliseconds: racer.airborneMilliseconds,
      engineSoundValue: racer.engineSoundValue,
    }
    const start = engineSounds[racerIndex] ?? INITIAL_ENGINE_SOUND_STATE
    // Race_LoadTrackContent 0x00433480 gives sound objects (0x00437540) to the human racers only.
    if (!soundRacerIndices.includes(racerIndex)) {
      return {
        racerIndex,
        racer,
        result: { state: start, loops: [], isSkidStarted: false },
        position: displayFrame.position,
      }
    }
    const result = subSteps.reduce(
      (current, subStep) => {
        const step = stepEngineSounds(current.state, input, subStep)
        return { ...step, isSkidStarted: current.isSkidStarted || step.isSkidStarted }
      },
      {
        state: start,
        loops: [] as ReturnType<typeof stepEngineSounds>['loops'],
        isSkidStarted: false,
      }
    )
    return { racerIndex, racer, result, position: displayFrame.position }
  })
  return Object.freeze({
    states: Object.freeze(steps.map((step) => step.result.state)),
    loops: Object.freeze(
      steps.map((step) =>
        Object.freeze({
          racerIndex: step.racerIndex,
          position: step.position,
          velocity: step.racer.carBody.rigidBody.linearVelocity,
          loops: step.result.loops,
        })
      )
    ),
    skidSounds: Object.freeze(
      steps.flatMap((step) => (step.result.isSkidStarted ? [getSkidStartSound()] : []))
    ),
  })
}

// One frame of presentation after `stepRace`: the player's camera and HUD advance, the music and sound effects the
// frame's events call for are chosen, and the camera and HUD bindings act. `controls` are the ones the frame ran with.
export const stepRacePresentation = (
  presentation: RacePresentation,
  step: RaceStepResult,
  controls: RacerControls,
  frameMilliseconds: number,
  hudContext: HudContext
): RacePresentationFrame => {
  const { raceState } = step
  const edits = getEditsForEvents(presentation, step)
  const isCameraCycled =
    controls.isChangeCameraPressed &&
    !presentation.isChangeCameraHeld &&
    edits.isCameraSwitchEnabled
  const cameraNumber = isCameraCycled
    ? (edits.cameraNumber + 1) % PLAYER_CAMERA_COUNT
    : edits.cameraNumber
  const switchedCamera = isCameraCycled
    ? requestCameraSnap(setCameraPreset(edits.camera, cameraNumber, false))
    : edits.camera
  const turboLevel = getTurboLevel(step, presentation.playerRacerIndex, presentation.turboLevel)
  const nextPresentation: RacePresentation = {
    ...presentation,
    hud: edits.hud,
    cameraNumber,
    isCameraSwitchEnabled: edits.isCameraSwitchEnabled,
    turboLevel,
    previousPhase: raceState.phase,
    isChangeCameraHeld: controls.isChangeCameraPressed,
  }
  // 0x0045dc90 state 3 and every warp draw (0x0045d940) call 0x0043a3e0: the camera snaps behind the racer on its next update.
  const snappedCamera = presentation.isWarpDrawn
    ? requestCameraSnap(switchedCamera)
    : switchedCamera
  const lookingBehind = setCameraLookingBehind(snappedCamera, controls.isLookBehindPressed)
  const cameraUpdate = getUpdatedCamera(
    lookingBehind,
    raceState,
    nextPresentation,
    frameMilliseconds
  )
  const hudFrame: HudFrame | null = HUD_PHASES.includes(raceState.phase)
    ? getHudFrame(edits.hud, {
        frameMilliseconds,
        layout: hudContext.layout,
        racer: getHudRacerView(raceState, presentation.playerRacerIndex),
        getString: hudContext.getString,
        imageNames: hudContext.imageNames,
        getImageSize: hudContext.getImageSize,
        measureText: hudContext.measureText,
        minimap: getHudMinimap(raceState, presentation.playerRacerIndex, hudContext),
      })
    : null
  // The demonstration has no human racer; the racer the camera follows has the sound objects then.
  const soundRacerIndices =
    raceState.playerRacerIndices.length === 0
      ? [presentation.playerRacerIndex]
      : raceState.playerRacerIndices
  const engine = getEngineSounds(
    raceState,
    presentation.engineSounds,
    frameMilliseconds,
    soundRacerIndices
  )
  const racer = getPlayerRacer(raceState, presentation.playerRacerIndex)
  const isPowerSliding = (racer.flags & POWER_SLIDING_FLAG) !== 0
  const powerSlideSounds: readonly SoundRequest[] =
    isPowerSliding === presentation.isPlayerPowerSliding ? [] : [getPowerSlideSound(isPowerSliding)]
  const soundContext: RaceSoundContext = {
    getHasSoundObjects: (racerIndex) => soundRacerIndices.includes(racerIndex),
    getRacerPosition: (racerIndex) =>
      raceState.racerSet.racers[racerIndex]?.carBody.rigidBody.displayFrame.position ?? null,
  }
  const hudSounds = (hudFrame?.soundIds ?? []).map((soundId) => getCountdownSound(soundId))
  const warpView = getWarpView(
    raceState,
    cameraUpdate.camera,
    presentation.playerRacerIndex,
    turboLevel
  )
  return Object.freeze({
    presentation: Object.freeze({
      ...nextPresentation,
      isWarpDrawn: warpView !== null,
      camera: cameraUpdate.camera,
      hud: hudFrame?.state ?? edits.hud,
      isPlayerPowerSliding: isPowerSliding,
      engineSounds: engine.states,
    }),
    cameraView: cameraUpdate.view,
    warpView,
    fieldOfViewDegrees:
      raceState.cameraFovEffects[
        raceState.playerRacerIndices.indexOf(presentation.playerRacerIndex)
      ]?.fov ?? INITIAL_FIELD_OF_VIEW_DEGREES,
    screenFades: getScreenFadeViews(
      raceState,
      raceState.playerRacerIndices.indexOf(presentation.playerRacerIndex),
      warpView
    ),
    hudFrame,
    sounds: Object.freeze([
      ...step.events.flatMap((event) => getRaceEventSounds(event, soundContext)),
      ...hudSounds,
      ...powerSlideSounds,
      ...engine.skidSounds,
    ]),
    loopedSounds: Object.freeze(
      step.events.flatMap((event) => getRaceEventLoops(event, soundContext))
    ),
    soundListener: getSoundListener(racer),
    nearestRacerSound: getNearestRacerSound(
      presentation.playerRacerIndex,
      raceState.racerSet.racers.map((candidate, racerIndex) =>
        Object.freeze({
          racerIndex,
          position: candidate.carBody.rigidBody.displayFrame.position,
          velocity: candidate.carBody.rigidBody.linearVelocity,
          speed: candidate.carBody.rigidBody.speed,
          engineSoundValue: candidate.engineSoundValue,
          airborneMilliseconds: candidate.airborneMilliseconds,
        })
      )
    ),
    engineLoops: engine.loops,
    music: edits.music,
  })
}
