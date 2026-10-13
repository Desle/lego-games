import { readRacerDatabases } from '@lego-games/lego-racers/race'
import {
  getChampionRacerAppearance,
  getRacerModelFiles,
  loadBuiltDriverScene,
  loadMenuDriverScene,
} from '@lego-games/lego-racers/racer-appearance'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import { createModelObject } from '../../../track-viewer/index.ts'
import { createLDrawDriverDrawing } from '../ldraw-racer/ldraw-driver-drawing.ts'
import { RacerPartKind } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import { getMinifigRig } from '../ldraw-racer/minifig-rig.ts'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'
import { getDriverMeasures } from './fidelity-anchors.ts'
import type { DriverRegion } from './fidelity-anchors.types.ts'
import { createSceneWith, createScaledScene } from './fidelity-pairs.ts'
import type { FidelityContext, FidelityPairOutcome } from './fidelity-pairs.types.ts'
import type { DriverModel, DriverPoseSource } from './fidelity-driver-pairs.types.ts'
import { FidelityItemKind, FidelityPose } from './ldraw-fidelity.types.ts'
import type { FidelityItem } from './ldraw-fidelity.types.ts'

// The poses the game shows a driver in. Seated: the race's resting clip 9 (`RESTING_ANIMATION`, vehicle.ts); steering: clip 6
// (`STEERING_POSITIVE`) 200 ms in; standing: the main menu's `LEGOMAN` figure at the start of clip 0 (0x00481000); menu idle: the Racer
// Select showcase's `RSANIM` clip 4, `breath2`, one second in (menu-backdrops.md).
const POSE_SOURCES: Readonly<Record<FidelityPose, DriverPoseSource>> = Object.freeze({
  [FidelityPose.SEATED]: { animationName: null, clipIndex: 9, milliseconds: 0 },
  [FidelityPose.STEERING]: { animationName: null, clipIndex: 6, milliseconds: 200 },
  [FidelityPose.STANDING]: { animationName: 'LEGOMAN', clipIndex: 0, milliseconds: 0 },
  [FidelityPose.MENU_IDLE]: { animationName: 'RSANIM', clipIndex: 4, milliseconds: 1000 },
})

// A catalogue part is measured in the region of the figure it makes: a hat or a face on the head, a torso with its arms, legs with the hips.
const SLOT_REGIONS: Partial<Record<FidelityItemKind, DriverRegion>> = Object.freeze({
  [FidelityItemKind.HAT]: 'head',
  [FidelityItemKind.FACE]: 'head',
  [FidelityItemKind.TORSO]: 'torso',
  [FidelityItemKind.LEGS]: 'seat',
})

// The original's figure in a pose: a champion seated in the race is his fixed model; anyone else seated is the figure builder's model
// of his part bytes, and standing the menus' figure of them.
const loadDriverModel = (
  context: FidelityContext,
  item: FidelityItem,
  source: DriverPoseSource
): DriverModel => {
  if (source.animationName !== null) {
    return {
      model: loadMenuDriverScene(context.archive, item.partBytes, source.animationName),
      modelName: null,
    }
  }
  if (item.driverName === null) {
    return { model: loadBuiltDriverScene(context.archive, item.partBytes), modelName: null }
  }
  const databases = readRacerDatabases((path) => context.archive.readFile(path))
  const names = getChampionRacerAppearance(databases, item.driverName, 0).driverModel
  if (names === null) {
    return { model: loadBuiltDriverScene(context.archive, item.partBytes), modelName: null }
  }
  return {
    model: loadModelScene(context.archive, getRacerModelFiles(names)),
    modelName: names.modelName,
  }
}

// A driver (a champion, or a catalogue part on the base figure) in one of the game's poses: the original's skeleton model against the
// LDraw minifigure on the same skeleton state; the attachment points are the head, hat, hands and seat.
export const createDriverPair = async (
  context: FidelityContext,
  item: FidelityItem
): Promise<FidelityPairOutcome> => {
  const source = POSE_SOURCES[item.pose ?? FidelityPose.SEATED]
  const { model, modelName } = loadDriverModel(context, item, source)
  const sampler = createSkeletonPoseSampler(model)
  const start = sampler?.createState(source.clipIndex) ?? null
  const rig = sampler === null ? null : getMinifigRig(sampler.boneNames)
  if (sampler === null || start === null || rig === null) return 'the figure has no such clip'
  const state = sampler.advance(start, source.milliseconds)
  const drawing = createLDrawDriverDrawing(
    {
      kind: RacerPartKind.DRIVER,
      archive: context.archive,
      model,
      modelName,
      partBytes: modelName === null ? item.partBytes : null,
    },
    '?hd'
  )
  if (drawing === null) return 'no LDraw driver for this figure'
  drawing.setAnimationState(state)
  await drawing.settled
  const original = createModelObject(model)
  original.object.setAnimationState(state)
  original.object.setLights(null)
  const replacement = createScaledScene(model, drawing.object)
  replacement.updateMatrixWorld(true)
  const measures = getDriverMeasures(
    model,
    rig,
    sampler.parentIndices,
    sampler.getMatrices(state),
    drawing.object
  )
  const region = SLOT_REGIONS[item.kind] ?? null
  const focus = region === null ? null : measures.regions[region]
  return {
    pair: { original: createSceneWith(original.group), replacement },
    anchors: measures.anchors,
    focus,
    note: region !== null && focus === null ? `no ${region} region; whole figure` : '',
    dispose: () => {
      original.object.dispose()
      drawing.dispose()
    },
  }
}
