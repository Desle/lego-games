import type { EffectViews, RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { Matrix3 } from '@lego-games/lego-racers/simulation-math'
import {
  Color,
  LinearSRGBColorSpace,
  Matrix4,
  PerspectiveCamera,
  Scene as ThreeScene,
  WebGLRenderer,
} from 'three'
import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { WorldAnimation } from '@lego-games/lego-racers/world-animation'
import { getCameraFrustum, ORIGINAL_FIELD_OF_VIEW_DEGREES } from './camera-frustum.ts'
import { createRaceParticles } from '../race-particles/race-particles.ts'
import { createRaceEffects } from '../race-effects/race-effects.ts'
import { createModelObject } from '../model-object/model-object.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { showSceneObjects } from '../scene-viewport/scene-viewport.ts'
import type { ShownScene } from '../scene-viewport/scene-viewport.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type {
  RaceStage,
  RaceStageSize,
  RaceViewport,
  RacerRig,
  Vector3Like,
} from './race-viewport.types.ts'

const BACKGROUND_COLOR = 0x101820
const NEAR_PLANE = 0.5
const FAR_PLANE = 20000
// Rows of a frame's rotation are the images of the model's axes; three.js takes them as columns.
const getFrameMatrix = (rotation: Matrix3, position: Vector3Like): Matrix4 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = rotation
  const { x, y, z } = position
  return new Matrix4().set(
    forwardX,
    sideX,
    upX,
    x,
    forwardY,
    sideY,
    upY,
    y,
    forwardZ,
    sideZ,
    upZ,
    z,
    0,
    0,
    0,
    1
  )
}

// The race's three.js scene graphs and camera, without a renderer: the sky and the backdrop first without the depth
// test, then the track and the cars, from the player's chase camera. The render trace reads this directly.
export const createRaceStage = (assets: RaceAssets, size: RaceStageSize): RaceStage => {
  const trackScene = new ThreeScene()
  const backgroundScene = new ThreeScene()
  const camera = new PerspectiveCamera(
    ORIGINAL_FIELD_OF_VIEW_DEGREES,
    size.width / size.height,
    NEAR_PLANE,
    FAR_PLANE
  )
  const shown: ShownScene = showSceneObjects(assets.scene, assets.background)
  // A mirrored race (Race_LoadTrackContent's flag) negates y in every loader; the world's instances sit where the
  // simulation puts them, so the track is drawn as its mirror image. three.js flips the faces of a mirrored object.
  if (assets.definition.isMirrored) shown.track.group.scale.set(1, -1, 1)
  trackScene.add(shown.track.group)
  const particles = createRaceParticles()
  trackScene.add(particles.points)
  if (shown.backdrop !== null) backgroundScene.add(shown.backdrop.group)
  if (shown.sky !== null) backgroundScene.add(shown.sky.mesh)
  const racerRigs = assets.racerModels.map((models): RacerRig => {
    const wheels = createModelObject(models.wheels)
    const body = models.body === null ? null : createModelObject(models.body)
    const driver = models.driver === null ? null : createModelObject(models.driver)
    const parts = [wheels, body, driver].filter((part): part is ModelObject => part !== null)
    for (const part of parts) {
      trackScene.add(part.group)
    }
    return { wheels, body, driver, objects: parts.map((part) => part.object) }
  })

  // The wheels sit in the display frame; the car model at its position with the leaned rotation of the model frame
  // (vehicle +0x3c); the driver at the seat carried by that frame (LEGORacers.exe 0x0043e740).
  const colourShiftKeys = new Map<number, string>()
  const effects = createRaceEffects(trackScene, assets.effectModels)
  const update = (
    poses: readonly RacerPose[],
    cameraView: CameraView,
    effectViews: EffectViews
  ) => {
    effects.update(effectViews)
    for (const pose of poses) {
      const racerRig = racerRigs[pose.racerIndex]
      if (racerRig === undefined) continue
      const shiftKey = JSON.stringify(pose.colourShift)
      if (colourShiftKeys.get(pose.racerIndex) !== shiftKey) {
        colourShiftKeys.set(pose.racerIndex, shiftKey)
        for (const object of racerRig.objects) object.setColourShift(pose.colourShift)
      }
      racerRig.wheels.group.matrix.copy(getFrameMatrix(pose.rotation, pose.position))
      racerRig.wheels.group.matrixWorldNeedsUpdate = true
      racerRig.wheels.object.setAnimationState(pose.wheelAnimation)
      if (racerRig.body !== null) {
        racerRig.body.group.matrix.copy(getFrameMatrix(pose.bodyRotation, pose.position))
        racerRig.body.group.matrixWorldNeedsUpdate = true
      }
      if (racerRig.driver !== null) {
        racerRig.driver.group.matrix.copy(getFrameMatrix(pose.bodyRotation, pose.driverPosition))
        racerRig.driver.group.matrixWorldNeedsUpdate = true
        racerRig.driver.object.setAnimationState(pose.driverAnimation)
      }
    }
    const { position, forward, up } = cameraView
    camera.position.set(position.x, position.y, position.z)
    // The engine's camera frames take a negated up vector (see the world's cameras).
    camera.up.set(-up.x, -up.y, -up.z)
    camera.lookAt(position.x + forward.x, position.y + forward.y, position.z + forward.z)
    shown.track.selectLevels(camera.position)
    shown.track.selectVisibleLeaves(getCameraFrustum(camera))
    const placement = shown.sky?.place(camera.position)
    if (shown.backdrop !== null) {
      const point = placement?.backdrop ?? camera.position
      shown.backdrop.group.position.set(point.x, point.y, point.z)
    }
  }

  const showHazards = (trackWorld: WorldAnimation, pools: readonly (EmitterPool | null)[]) => {
    for (const instance of trackWorld.skeletonInstances) {
      if (instance.clip !== null) shown.track.setSkeletonState(instance.name, instance.clip)
    }
    particles.update(pools)
  }

  return Object.freeze({
    trackScene,
    backgroundScene,
    camera,
    racerRigs,
    update,
    showHazards,
    animate: (deltaMilliseconds: number) => {
      shown.backdrop?.animate(deltaMilliseconds)
      shown.sky?.animate(deltaMilliseconds)
    },
    dispose: () => {
      particles.dispose()
      shown.track.dispose()
      shown.backdrop?.dispose()
      shown.sky?.dispose()
      effects.dispose()
      for (const { objects } of racerRigs) for (const object of objects) object.dispose()
    },
  })
}

// The race drawn as the engine does (LEGORacers.exe 0x004357b0).
export const createRaceViewport = (
  container: HTMLElement,
  assets: RaceAssets,
  size: RaceStageSize
): RaceViewport => {
  const renderer = new WebGLRenderer({ antialias: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(new Color(BACKGROUND_COLOR))
  renderer.autoClear = false
  renderer.setSize(size.width, size.height)
  container.appendChild(renderer.domElement)
  const stage = createRaceStage(assets, size)
  return Object.freeze({
    update: stage.update,
    showHazards: stage.showHazards,
    animate: stage.animate,
    render: () => {
      renderer.clear()
      renderer.render(stage.backgroundScene, stage.camera)
      renderer.render(stage.trackScene, stage.camera)
    },
    dispose: () => {
      stage.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  })
}
