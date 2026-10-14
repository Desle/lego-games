import type { Object3D } from 'three'
import type {
  EffectSighting,
  EffectSweepCall,
  EffectSweepFrame,
  EffectSweepResult,
} from '../../../../shared/effect-sweep/effect-sweep.types.ts'
import { registerViewerExtension } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { runPixelTrace } from '../../../track-viewer/index.ts'
import type { PixelTraceRequest } from '../../../track-viewer/index.ts'
import { HookKind } from '../hd-coverage/hd-coverage.types.ts'
import { createRecordingExtension } from '../hd-coverage/hd-coverage-recorder.ts'
import type { CoverageRecorder } from '../hd-coverage/hd-coverage-recorder.types.ts'
import {
  drainErrors,
  getChangedPixels,
  readPixels,
  watchRenderedScenes,
} from '../hd-coverage/on-screen-check.ts'
import {
  createRemasteredExtension,
  getIsRemasteredRequested,
} from '../remastered-registration/remastered-registration.ts'
import { findEffectElements } from './effect-sweep-census.ts'
import type { EffectElement, LayerEffect } from './effect-sweep-census.types.ts'

const getSightingKey = (element: EffectElement): string =>
  `${element.origin}|${element.kind}|${element.key}`

const getMeshes = (objects: readonly Object3D[]): readonly Object3D[] => {
  const meshes: Object3D[] = []
  for (const object of objects) {
    object.traverseVisible((child) => {
      if ('isMesh' in child && child.isMesh === true) meshes.push(child)
    })
  }
  return meshes
}

const getLayerEffectReader =
  (recorder: CoverageRecorder | null) =>
  (object: Object3D): LayerEffect | null => {
    if (recorder === null) return null
    const callId = recorder.getCallId(object)
    if (callId === null) return null
    const call = recorder.getCalls().find((candidate) => candidate.id === callId)
    if (call?.hook === HookKind.EFFECT_MODEL) return { kind: 'model', key: call.key }
    return call?.hook === HookKind.PARTICLE ? { kind: 'particle', key: call.key } : null
  }

const getEffectCalls = (recorder: CoverageRecorder | null): readonly EffectSweepCall[] =>
  (recorder?.getCalls() ?? [])
    .filter((call) => call.hook === HookKind.EFFECT_MODEL || call.hook === HookKind.PARTICLE)
    .map((call) => ({
      key: call.key,
      isModelPresent: call.isModelPresent,
      isDrawingReturned: call.isDrawingReturned,
    }))

// The page of the power-up effect sweep (`/?effect-sweep` for Classic, `/?hd&effect-sweep` for the remastered layer): the pixel
// trace's scripted race, and at each recorded frame every effect element on screen, each key hidden in turn to count its pixels.
export const installEffectSweepHarness = async (search: string) => {
  const recording = getIsRemasteredRequested(search)
    ? createRecordingExtension(await createRemasteredExtension(search))
    : null
  if (recording !== null) registerViewerExtension(recording.extension)
  const recorder = recording?.recorder ?? null
  const getLayerEffect = getLayerEffectReader(recorder)
  const watch = watchRenderedScenes()
  let webglErrors: readonly number[] = []

  const measureFrame = (
    drawFrame: () => HTMLCanvasElement
  ): Omit<EffectSweepFrame, 'frame' | 'colorsBase64'> => {
    watch.start()
    const shown = readPixels(drawFrame())
    watch.stop()
    const unchangedDifference = getChangedPixels(shown, readPixels(drawFrame()))
    const elements = [...watch.getScenes()].flatMap((scene) =>
      findEffectElements(scene, getLayerEffect)
    )
    const groups = new Map<string, EffectElement[]>()
    for (const element of elements) {
      const key = getSightingKey(element)
      groups.set(key, [...(groups.get(key) ?? []), element])
    }
    const sightings = [...groups.values()].flatMap((members): readonly EffectSighting[] => {
      const [first] = members
      if (first === undefined) return []
      const meshes = getMeshes(members.map((member) => member.object))
      const visibilities = meshes.map((mesh) => mesh.visible)
      for (const mesh of meshes) mesh.visible = false
      const hidden = readPixels(drawFrame())
      for (const [index, mesh] of meshes.entries()) mesh.visible = visibilities[index] ?? true
      return [
        {
          origin: first.origin,
          kind: first.kind,
          key: first.key,
          count: members.length,
          emptyCount: members.filter((member) => member.isEmpty).length,
          partCounts: members.filter((member) => !member.isEmpty).map((member) => member.partCount),
          changedPixels: getChangedPixels(shown, hidden),
        },
      ]
    })
    webglErrors = [...webglErrors, ...drainErrors(watch.getRenderers())]
    return { unchangedDifference, sightings }
  }

  const runEffectSweep = async (request: PixelTraceRequest): Promise<EffectSweepResult> => {
    recorder?.reset()
    webglErrors = []
    const measured = new Map<number, Omit<EffectSweepFrame, 'frame' | 'colorsBase64'>>()
    const pixels = await runPixelTrace(request, (frame, drawFrame) =>
      measured.set(frame, measureFrame(drawFrame))
    )
    const frames = pixels.frames.map((pixelFrame) => ({
      ...pixelFrame,
      unchangedDifference: measured.get(pixelFrame.frame)?.unchangedDifference ?? 0,
      sightings: measured.get(pixelFrame.frame)?.sightings ?? [],
    }))
    return { frames, calls: getEffectCalls(recorder), webglErrors }
  }
  Object.assign(window, { runEffectSweep })
}
