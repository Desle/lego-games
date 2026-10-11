import type { RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import {
  Color,
  Group,
  LinearSRGBColorSpace,
  Matrix4,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { WorldAnimation } from '@lego-games/lego-racers/world-animation'
import { createRaceParticles } from '../race-particles/race-particles.ts'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { RacerModels, RaceAssets } from '../race-assets/race-assets.types.ts'
import { showSceneObjects } from '../scene-viewport/scene-viewport.ts'
import type { ShownScene } from '../scene-viewport/scene-viewport.types.ts'
import type { ModelObject, RaceStageSize, RaceViewport } from './race-viewport.types.ts'

// The Direct3D camera's field of view is not traced yet; the track viewer's 60 degrees stand in for it.
const FIELD_OF_VIEW_DEGREES = 60
const BACKGROUND_COLOR = 0x101820
const NEAR_PLANE = 0.5
const FAR_PLANE = 20000
// PLACEHOLDER: where the driver sits in the car comes from the chassis database (not ported); a point above the
// car's origin stands in for it until the `cars-and-drivers` branch is on main.
const DRIVER_SEAT_OFFSET = new Vector3(0, 0, 1.3)

// Rows of a frame's rotation are the images of the model's axes; three.js takes them as columns.
const getPoseMatrix = (pose: RacerPose): Matrix4 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = pose.rotation
  const { x, y, z } = pose.position
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

const createModelObject = (model: RacerModels['car'], offset: Vector3): ModelObject => {
  const object = createSceneObject(model.scene, {
    includeInstance: () => true,
    isBackground: false,
  })
  const group = new Group()
  group.scale.setScalar(model.meshScales[0] ?? 1)
  group.position.copy(offset)
  group.add(object.group)
  return { group, object }
}

// The race drawn as the engine does (LEGORacers.exe 0x004357b0): the sky and the backdrop first without the depth
// test, then the track and the cars, from the player's chase camera.
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
  const trackScene = new ThreeScene()
  const backgroundScene = new ThreeScene()
  const camera = new PerspectiveCamera(
    FIELD_OF_VIEW_DEGREES,
    size.width / size.height,
    NEAR_PLANE,
    FAR_PLANE
  )
  const shown: ShownScene = showSceneObjects(assets.scene, assets.background)
  trackScene.add(shown.track.group)
  const particles = createRaceParticles()
  trackScene.add(particles.points)
  if (shown.backdrop !== null) backgroundScene.add(shown.backdrop.group)
  if (shown.sky !== null) backgroundScene.add(shown.sky.mesh)
  const racerRigs = assets.racerModels.map((models) => {
    const rig = new Group()
    rig.matrixAutoUpdate = false
    const car = createModelObject(models.car, new Vector3())
    const driver = createModelObject(models.driver, DRIVER_SEAT_OFFSET)
    rig.add(car.group, driver.group)
    trackScene.add(rig)
    return { rig, objects: [car.object, driver.object] }
  })

  const update = (poses: readonly RacerPose[], cameraView: CameraView) => {
    for (const pose of poses) {
      const racerRig = racerRigs[pose.racerIndex]
      if (racerRig === undefined) continue
      racerRig.rig.matrix.copy(getPoseMatrix(pose))
      racerRig.rig.matrixWorldNeedsUpdate = true
    }
    const { position, forward, up } = cameraView
    camera.position.set(position.x, position.y, position.z)
    // The engine's camera frames take a negated up vector (see the world's cameras).
    camera.up.set(-up.x, -up.y, -up.z)
    camera.lookAt(position.x + forward.x, position.y + forward.y, position.z + forward.z)
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
    update,
    showHazards,
    animate: (deltaMilliseconds: number) => {
      shown.backdrop?.animate(deltaMilliseconds)
      shown.sky?.animate(deltaMilliseconds)
    },
    render: () => {
      renderer.clear()
      renderer.render(backgroundScene, camera)
      renderer.render(trackScene, camera)
    },
    dispose: () => {
      particles.dispose()
      shown.track.dispose()
      shown.backdrop?.dispose()
      shown.sky?.dispose()
      for (const { objects } of racerRigs) for (const object of objects) object.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  })
}
