import { POWER_UP_OBJECT_MODEL_NAMES } from '../../../../shared/viewer-extensions/effect-model-names.ts'
import { HookKind, RacerPartKind } from './hd-coverage.types.ts'
import type { CensusSighting, HookCall } from './hd-coverage.types.ts'
import type { OnScreenDrawing, OnScreenFrame } from './on-screen-check.types.ts'

// Fewer changed pixels than this (above the frame's own noise) is nothing on screen: a 640 x 480 frame's figure covers thousands.
const MIN_CHANGED_PIXELS = 50

const getThreshold = (frame: OnScreenFrame): number =>
  MIN_CHANGED_PIXELS + frame.unchangedDifference

const getIsOnScreen = (frame: OnScreenFrame, changedPixels: number): boolean =>
  changedPixels >= getThreshold(frame)

const formatError = (error: number): string => `0x${error.toString(16)}`

// Each plain (unpictured) material kind of the drawings on screen changes the frame somewhere: one part may hide behind another
// car and a picture may face away (the back of a torso), but a kind whose every mesh draws nothing has a shader WebGL refuses.
const getMaterialFailures = (
  frame: OnScreenFrame,
  drawings: readonly OnScreenDrawing[]
): readonly string[] => {
  const groups = drawings.flatMap((drawing) => drawing.groups.filter((group) => !group.isPictured))
  const materials = [...new Set(groups.map((group) => group.material))].sort()
  return materials.flatMap((material) => {
    const members = groups.filter((group) => group.material === material)
    const changedPixels = members.reduce((sum, group) => sum + group.changedPixels, 0)
    const meshCount = members.reduce((sum, group) => sum + group.meshCount, 0)
    return getIsOnScreen(frame, changedPixels)
      ? []
      : [
          `${frame.label}: the ${material} meshes (${String(meshCount)}) of the drawings on screen changed ${String(changedPixels)} pixels`,
        ]
  })
}

// What keeps the layer's drawings of the measured frames off the screen: a WebGL error of any draw, a racer part the place must
// show that no drawing of it reaches, or a material kind of the drawings on screen that draws nothing.
export const getOnScreenFailures = (
  frames: readonly OnScreenFrame[],
  expectedHooks: readonly HookKind[]
): readonly string[] =>
  frames.flatMap((frame) => {
    const shownDrawings = frame.drawings.filter((drawing) =>
      getIsOnScreen(frame, drawing.changedPixels)
    )
    return [
      ...(frame.webglErrors.length === 0
        ? []
        : [`${frame.label}: WebGL errors ${frame.webglErrors.map(formatError).join(', ')}`]),
      ...expectedHooks
        .filter((hook) => !shownDrawings.some((drawing) => drawing.hook === hook))
        .map((hook) => `${frame.label}: no ${hook} drawing reached the screen`),
      ...getMaterialFailures(frame, shownDrawings),
    ]
  })

// Every power-up object the place drew from its file (a call that found the file and returned a drawing) reaches the screen in
// one of the measured frames.
export const getPowerUpOnScreenFailures = (
  frames: readonly OnScreenFrame[],
  calls: readonly HookCall[]
): readonly string[] => {
  const drawnKeys = [
    ...new Set(
      calls
        .filter(
          (call) =>
            call.hook === HookKind.EFFECT_MODEL &&
            call.isModelPresent &&
            call.isDrawingReturned &&
            POWER_UP_OBJECT_MODEL_NAMES.includes(call.key)
        )
        .map((call) => call.key)
    ),
  ].sort()
  const unshown = drawnKeys
    .filter(
      (key) =>
        !frames.some((frame) =>
          frame.drawings.some(
            (drawing) => drawing.key === key && getIsOnScreen(frame, drawing.changedPixels)
          )
        )
    )
    .map((key) => `the power-up object ${key} reached the screen in none of the frames`)
  return [...unshown, ...getPosedPartFailures(frames, drawnKeys)]
}

// The objects drawn as several posed parts that must show them side by side: the twin turbo's two burners. Not its flames (see
// through, and one hides behind the car in the measured frames) nor ENHANER (its two trails start on the same spot).
const SIDE_BY_SIDE_MODEL_NAMES: readonly string[] = ['DT2CBURN']

// A drawing of several posed parts side by side (the file once for each group of the original's mesh) shows every part at once
// in one of the measured frames.
const getPosedPartFailures = (
  frames: readonly OnScreenFrame[],
  drawnKeys: readonly string[]
): readonly string[] =>
  drawnKeys.flatMap((key) => {
    if (!SIDE_BY_SIDE_MODEL_NAMES.includes(key)) return []
    const partCounts = frames.flatMap((frame) =>
      frame.drawings
        .filter((drawing) => drawing.key === key && drawing.posedPartPixels.length > 1)
        .map((drawing) => drawing.posedPartPixels.length)
    )
    if (partCounts.length === 0) return []
    const isEveryPartShown = frames.some((frame) =>
      frame.drawings.some(
        (drawing) =>
          drawing.key === key &&
          drawing.posedPartPixels.length > 1 &&
          drawing.posedPartPixels.every((pixels) => getIsOnScreen(frame, pixels))
      )
    )
    return isEveryPartShown
      ? []
      : [
          `the power-up object ${key}'s ${String(Math.max(...partCounts))} posed parts never all reached the screen in one frame`,
        ]
  })

// Every power-up object the place must draw is in a rendered frame, drawn from its file or as the original's model: an effect the
// race stops drawing fails here whether or not the folder has a file for it.
export const getExpectedPowerUpFailures = (
  sightings: readonly CensusSighting[],
  expectedKeys: readonly string[]
): readonly string[] =>
  expectedKeys
    .filter(
      (key) =>
        !sightings.some(
          (sighting) => sighting.kind === RacerPartKind.POWER_UP && sighting.key === key
        )
    )
    .map((key) => `the power-up object ${key} was drawn in none of the rendered frames`)

export const formatOnScreenDrawing = (frame: OnScreenFrame, drawing: OnScreenDrawing): string =>
  [
    `${frame.label} ${drawing.hook} ${drawing.key}: ${String(drawing.changedPixels)} pixels`,
    ...drawing.groups.map(
      (group) =>
        `${group.material}${group.isPictured ? ' pictured' : ''} x${String(group.meshCount)} ${String(group.changedPixels)}`
    ),
    ...(drawing.posedPartPixels.length === 0
      ? []
      : [`posed parts ${drawing.posedPartPixels.map(String).join(' ')}`]),
  ].join('; ')
