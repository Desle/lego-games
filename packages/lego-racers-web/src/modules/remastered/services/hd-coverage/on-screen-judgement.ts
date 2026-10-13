import { POWER_UP_OBJECT_MODEL_NAMES } from '../../../../shared/viewer-extensions/effect-model-names.ts'
import { HookKind } from './hd-coverage.types.ts'
import type { HookCall } from './hd-coverage.types.ts'
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
  return drawnKeys
    .filter(
      (key) =>
        !frames.some((frame) =>
          frame.drawings.some(
            (drawing) => drawing.key === key && getIsOnScreen(frame, drawing.changedPixels)
          )
        )
    )
    .map((key) => `the power-up object ${key} reached the screen in none of the frames`)
}

export const formatOnScreenDrawing = (frame: OnScreenFrame, drawing: OnScreenDrawing): string =>
  [
    `${frame.label} ${drawing.hook} ${drawing.key}: ${String(drawing.changedPixels)} pixels`,
    ...drawing.groups.map(
      (group) =>
        `${group.material}${group.isPictured ? ' pictured' : ''} x${String(group.meshCount)} ${String(group.changedPixels)}`
    ),
  ].join('; ')
