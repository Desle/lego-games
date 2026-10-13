import {
  createRace,
  getRaceStateWithGrants,
  NO_RACE_CONTACTS,
  stepRace,
} from '../../../race/index.ts'
import type { RaceDefinition, RaceState } from '../../../race/index.ts'
import { CameraMode } from '../../../race-camera/index.ts'
import type { CameraModeValue } from '../../../race-camera/index.ts'
import type { Racer } from '../../../racer/index.ts'
import { getHudLayout, HudFont } from '../../../race-hud/index.ts'
import { createRacePresentation, stepRacePresentation } from '../../../race-presentation/index.ts'
import type {
  HudContext,
  RacePresentation,
  RacePresentationFrame,
} from '../../../race-presentation/index.ts'
import type {
  GoldenTraceScenario,
  TraceFields,
  TraceFrame,
} from '../../types/golden-trace.types.ts'
import { getFrameControls } from '../port-trace/port-trace.ts'
import { getFloatWords, getVectorWords } from '../trace-words/trace-words.ts'

// The Gol camera frame's aspect ratio, near plane and far plane (frame +0xc, +0x10, +0x14) as the 640 by 480 window gives them.
// @check-allow traced-constants: read from the Gol camera frame in the trace (frame +0xc, +0x10, +0x14), not behaviour
const FRAME_ASPECT_RATIO = 4 / 3
// @check-allow traced-constants: read from the Gol camera frame in the trace
const FRAME_NEAR_PLANE = 5
// @check-allow traced-constants: read from the Gol camera frame in the trace
const FRAME_FAR_PLANE = 800

// Camera +0x02.
// @check-allow traced-constants: the mode byte values 0 to 3 (camera-mode.ts)
const MODE_NUMBERS: Readonly<Record<CameraModeValue, number>> = {
  [CameraMode.INTRODUCTION]: 0,
  [CameraMode.CHASE]: 1,
  [CameraMode.COCKPIT]: 2,
  [CameraMode.FINISH]: 3,
}

const measureText = (font: string, text: string) => ({
  // @check-allow traced-constants: test-only HUD text sizes
  width: text.length * (font === HudFont.DIGITS ? 30 : 10),
  // @check-allow traced-constants: test-only HUD text sizes
  height: 16,
})
const getString = (stringId: number) => `string ${String(stringId)}`

// The camera does not read the HUD; this is the smallest context the presentation accepts.
// @check-allow traced-constants: test-only HUD layout sizes
const CAMERA_TRACE_HUD_CONTEXT: HudContext = {
  layout: getHudLayout({
    screenWidth: 640,
    screenHeight: 480,
    measureText,
    getString,
    holderSize: { width: 64, height: 64 },
  }),
  getString,
  imageNames: [],
  getImageSize: () => null,
  displayBounds: null,
  isMirrored: false,
  mapImageName: null,
  measureText,
}

export const CAMERA_TRACE_FIELDS: readonly string[] = [
  'camera0.mode',
  'camera0.basis',
  'camera0.eye',
  'camera0.racer',
  'camera0.chase',
  'camera0.target',
  'camera0.preset',
  'camera0.node.position',
  'camera0.node.orientation',
  'camera0.view',
]

// The names golden_trace.py `snapshot_camera_fields` writes for the first local player.
export const getCameraTraceFields = (
  frame: RacePresentationFrame,
  racer: Racer | undefined
): TraceFields => {
  const { camera } = frame.presentation
  const displayFrame = racer?.carBody.rigidBody.displayFrame
  const { position, forward, up } = frame.cameraView
  return {
    'camera0.mode': [MODE_NUMBERS[camera.mode], camera.isLookingBehind ? 1 : 0],
    'camera0.basis': getFloatWords(camera.basis),
    'camera0.eye': getVectorWords(camera.position),
    'camera0.racer':
      racer === undefined || displayFrame === undefined
        ? []
        : [
            ...getFloatWords(displayFrame.rotation),
            ...getVectorWords(displayFrame.position),
            ...getFloatWords([
              racer.carBody.rigidBody.forwardSpeed,
              racer.carBody.rigidBody.turnRadius,
            ]),
            racer.carBody.rigidBody.flags >>> 0,
            racer.driver.flags >>> 0,
            frame.presentation.turboLevel >>> 0,
          ],
    'camera0.chase': [
      ...getVectorWords(camera.heading),
      ...getVectorWords(camera.lookAtPoint),
      ...getFloatWords([camera.steeringAngle]),
      camera.isFullThrottle ? 1 : 0,
      ...getFloatWords([camera.distanceFactor]),
    ],
    'camera0.target': [
      ...getFloatWords(camera.targetBasis),
      ...getVectorWords(camera.targetPosition),
    ],
    'camera0.preset': getFloatWords([
      camera.heightSine,
      camera.pitchSine,
      camera.pitchCosine,
      camera.distance,
      camera.finishOffsets.heightSine,
      camera.finishOffsets.pitchSine,
      camera.finishOffsets.pitchCosine,
      camera.finishOffsets.distance,
      camera.positionRate,
      camera.rotationRate,
      camera.modeMilliseconds,
      camera.stepMilliseconds,
    ]),
    'camera0.node.position': getVectorWords(position),
    'camera0.node.orientation': [...getVectorWords(forward), ...getVectorWords(up)],
    'camera0.view': getFloatWords([
      frame.fieldOfViewDegrees,
      FRAME_ASPECT_RATIO,
      FRAME_NEAR_PLANE,
      FRAME_FAR_PLANE,
    ]),
  }
}

// Steps the port's race and its presentation with the scenario's frames, as the viewer does, and records the camera.
export const getPortCameraTrace = (
  scenario: GoldenTraceScenario,
  definition: RaceDefinition
): readonly TraceFrame[] => {
  let raceState: RaceState = createRace(definition)
  let presentation: RacePresentation = createRacePresentation(raceState, 0).presentation
  return scenario.frames.map((input, frame) => {
    const controls = getFrameControls(input)
    const step = stepRace(
      getRaceStateWithGrants(
        raceState,
        scenario.powerUpGrants.filter((grant) => grant.frame === frame)
      ),
      { controls: [controls], contacts: NO_RACE_CONTACTS },
      input.milliseconds
    )
    raceState = step.raceState
    const presented = stepRacePresentation(
      presentation,
      step,
      controls,
      input.milliseconds,
      CAMERA_TRACE_HUD_CONTEXT
    )
    presentation = presented.presentation
    return {
      frame,
      milliseconds: input.milliseconds,
      fields: getCameraTraceFields(
        presented,
        raceState.racerSet.racers[presented.presentation.playerRacerIndex]
      ),
    }
  })
}
