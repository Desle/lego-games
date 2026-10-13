import { RACER_SHOWCASE_CAR_POSITION } from '@lego-games/lego-racers/front-end'
import type { RacerShowcaseView } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltCarScene } from '@lego-games/lego-racers/racer-appearance'
import type { Scene } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Matrix4 } from 'three'
import type { Scene as ThreeScene } from 'three'
import type { DriverView } from '../driver-view/driver-view.types.ts'
import { getCarDesignKey } from '../car-design-key/car-design-key.ts'
import { createModelObject } from '../model-object/model-object.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import { loadChassisWheels } from '../racer-drawing/chassis-wheels.ts'
import { showCarDrawing } from '../racer-drawing/racer-drawing.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { ShowcaseStage } from './showcase-stage.types.ts'

// The skeleton instances of `RS_SET\BLENDED.WDB`: the shadow under the car turns with the turntable (`crsdow`, clip `a0` of
// 200 frames) and the car follows its bone (0x004865c0); the one under the driver stands still.
const CAR_SHADOW_NAME = 'crsdow'
const DRIVER_SHADOW_NAME = 'shadow'
const TURNTABLE_CLIP_INDEX = 0

// The wheels of the car's chassis in the files the race reads, at rest.
const showWheels = (archive: JamArchive, chassisName: string): ModelObject =>
  createModelObject(loadChassisWheels(archive, chassisName).model)

// The car's turn at a time: the instance's own heading plus the bone's turn, which both rotate about the vertical axis.
export const getCarYaw = (scene: Scene, state: SkeletonAnimationState): number => {
  const instance = scene.instances.find((candidate) => candidate.name === CAR_SHADOW_NAME)
  const level = instance?.levels[0]
  const skeleton = scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = scene.animations[level?.animationIndex ?? -1]?.animation
  if (instance === undefined || skeleton === undefined || animation === undefined) return 0
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(getRestPose(skeleton), animation, state)
  )
  return (
    Math.atan2(instance.rotation[1], instance.rotation[0]) +
    Math.atan2(matrices[1] ?? 0, matrices[0] ?? 1)
  )
}

export const getTurntableState = (
  scene: Scene,
  milliseconds: number
): SkeletonAnimationState | null => {
  const instance = scene.instances.find((candidate) => candidate.name === CAR_SHADOW_NAME)
  const animation = scene.animations[instance?.levels[0]?.animationIndex ?? -1]?.animation
  if (animation === undefined) return null
  return advanceSkeletonAnimation(
    createSkeletonAnimationState(animation, TURNTABLE_CLIP_INDEX),
    animation,
    milliseconds
  )
}

export const createShowcaseStage = (
  archive: JamArchive,
  three: ThreeScene,
  scene: Scene,
  worldObject: SceneObject,
  driverView: DriverView
): ShowcaseStage => {
  const carSlot = createModelSlot(three)
  const wheelSlot = createModelSlot(three)
  let isCarDrawn = false
  return Object.freeze({
    show: (view: RacerShowcaseView) => {
      const turntable = getTurntableState(scene, view.turntableMilliseconds)
      if (turntable !== null) {
        worldObject.setSkeletonState(CAR_SHADOW_NAME, turntable)
        worldObject.setSkeletonState(DRIVER_SHADOW_NAME, turntable)
      }
      if (view.design !== null) {
        const design = view.design
        const car = carSlot.show(getCarDesignKey(design), () => {
          const model = createModelObject(loadBuiltCarScene(archive, design))
          const shown = showCarDrawing(model, {
            archive,
            carCode: null,
            design,
            wheels: loadChassisWheels(archive, view.chassisName),
          })
          isCarDrawn = shown !== model
          return shown
        })
        const [x, y, z] = RACER_SHOWCASE_CAR_POSITION
        car.group.matrix
          .copy(new Matrix4().makeRotationZ(turntable === null ? 0 : getCarYaw(scene, turntable)))
          .setPosition(x, y, z)
        car.group.matrixWorldNeedsUpdate = true
        if (isCarDrawn) {
          wheelSlot.dispose()
        } else {
          const wheels = wheelSlot.show(view.chassisName, () =>
            showWheels(archive, view.chassisName)
          )
          wheels.group.matrix.copy(car.group.matrix)
          wheels.group.matrixWorldNeedsUpdate = true
        }
      }
      driverView.show(view.driver)
    },
    dispose: () => {
      carSlot.dispose()
      wheelSlot.dispose()
    },
  })
}
