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
  getPowerSlideSound,
  getRaceEventSounds,
  getTuneMusic,
} from '../../../race-audio/index.ts'
import type { SoundRequest } from '../../../race-audio/index.ts'
import {
  createHudState,
  finishHud,
  getHudFrame,
  startHudCountdown,
} from '../../../race-hud/index.ts'
import type { HudFrame, HudRacerView } from '../../../race-hud/index.ts'
import { RacePhase } from '../../../race/index.ts'
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
// The countdown and racing and finishing states draw the HUD (Race_Render 0x004354d0 calls slot +0x40 in 2..4).
const HUD_PHASES: readonly string[] = [RacePhase.COUNTDOWN, RacePhase.RACING, RacePhase.FINISHING]

const getPlayerRacer = (raceState: RaceState, playerRacerIndex: number): Racer =>
  getRacer(raceState.racerSet, playerRacerIndex)

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
      isPlayerPowerSliding: false,
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
  const lookingBehind = setCameraLookingBehind(switchedCamera, controls.isLookBehindPressed)
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
      })
    : null
  const racer = getPlayerRacer(raceState, presentation.playerRacerIndex)
  const isPowerSliding = (racer.flags & POWER_SLIDING_FLAG) !== 0
  const powerSlideSounds: readonly SoundRequest[] =
    isPowerSliding === presentation.isPlayerPowerSliding ? [] : [getPowerSlideSound(isPowerSliding)]
  const hudSounds = (hudFrame?.soundIds ?? []).map((soundId) => getCountdownSound(soundId))
  return Object.freeze({
    presentation: Object.freeze({
      ...nextPresentation,
      camera: cameraUpdate.camera,
      hud: hudFrame?.state ?? edits.hud,
      isPlayerPowerSliding: isPowerSliding,
    }),
    cameraView: cameraUpdate.view,
    hudFrame,
    sounds: Object.freeze([
      ...step.events.flatMap((event) => getRaceEventSounds(event)),
      ...hudSounds,
      ...powerSlideSounds,
    ]),
    music: edits.music,
  })
}
