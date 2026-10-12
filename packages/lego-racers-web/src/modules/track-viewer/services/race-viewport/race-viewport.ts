import type {
  EffectViews,
  GhostCar,
  RacerPose,
  ScreenFadeView,
  SpriteView,
  WarpView,
} from '@lego-games/lego-racers/race-presentation'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { RibbonView } from '@lego-games/lego-racers/ribbon'
import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { Mesh, MeshBasicMaterial } from 'three'
import {
  Color,
  Group,
  LinearSRGBColorSpace,
  Matrix4,
  PerspectiveCamera,
  Scene as ThreeScene,
  WebGLRenderer,
} from 'three'
import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import { getSkeletonInstanceSphere } from '@lego-games/lego-racers/world-animation'
import type { RaceWorlds } from '@lego-games/lego-racers/world-animation'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '@lego-games/lego-racers/simulation-math'
import { getCameraFrustum, ORIGINAL_FIELD_OF_VIEW_DEGREES } from './camera-frustum.ts'
import { getIsWithinLevelDistance } from '../scene-object/level-distance.ts'
import { createRaceDecals } from '../race-decals/race-decals.ts'
import { createRaceParticles } from '../race-particles/race-particles.ts'
import { getFrameMatrix } from '../frame-matrix/frame-matrix.ts'
import { createRaceEffects } from '../race-effects/race-effects.ts'
import { createScreenFadeOverlay } from '../screen-fade-overlay/screen-fade-overlay.ts'
import { setAlphaOverride } from '../scene-object/alpha-override.ts'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import { getRaceRenderPasses } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { createModelObject } from '../model-object/model-object.ts'
import { attachCarDrawing, attachDriverDrawing } from '../racer-drawing/racer-drawing.ts'
import type {
  CarDrawingRequest,
  DriverDrawingRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getDriverPartBytes } from '@lego-games/lego-racers/car-builder'
import { GHOST_WORLD_PATH, WARP_WORLD_PATH } from '../race-assets/race-assets.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { showSceneObjects } from '../scene-viewport/scene-viewport.ts'
import type { ShownScene } from '../scene-viewport/scene-viewport.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type {
  RaceStage,
  RaceStageSize,
  RaceViewport,
  RacerModelObjects,
  RacerRig,
} from './race-viewport.types.ts'

const BACKGROUND_COLOR = 0x101820
const getPosition = (position: readonly [number, number, number]) => ({
  x: position[0],
  y: position[1],
  z: position[2],
})
const sphereArithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const MILLISECONDS_PER_SECOND = 1000
// The scroll the original adds stays below 1 (it wraps).
const getWrappedFraction = (value: number): number => value - Math.floor(value)
const NEAR_PLANE = 0.5
const FAR_PLANE = 20000
// Race_Render's update (0x00435a00) draws the ghost cars between the device's alpha override (0x00422960 calls slot 0xb8
// with 0x7f and 0, slot 0xbc afterwards): every vertex of both cars takes alpha 127 and blends over the picture.
const GHOST_ALPHA = 0x7f
const GHOST_OPACITY = GHOST_ALPHA / 0xff

// What a viewer extension is asked to draw for a racer's car: the champion's body model by its code, or the player's built design,
// with the wheels the race made from the racer's appearance.
const getCarRequest = (assets: RaceAssets, racerIndex: number): CarDrawingRequest | null => {
  const racer = assets.definition.racers[racerIndex]
  const models = assets.racerModels[racerIndex]
  if (racer === undefined || models === undefined) return null
  const design = racer.savedCar?.design ?? null
  return {
    archive: assets.archive,
    carCode: design === null ? (racer.appearance.bodyModel?.modelName.toUpperCase() ?? null) : null,
    design,
    wheels: {
      model: models.wheels,
      modelName: racer.appearance.wheelModel.modelName,
      partBytes: null,
    },
  }
}

const getDriverRequest = (assets: RaceAssets, racerIndex: number): DriverDrawingRequest | null => {
  const racer = assets.definition.racers[racerIndex]
  const model = assets.racerModels[racerIndex]?.driver
  if (racer === undefined || model === undefined || model === null) return null
  return {
    archive: assets.archive,
    driver: {
      model,
      modelName: racer.appearance.driverModel?.modelName ?? null,
      partBytes: racer.savedCar == null ? null : getDriverPartBytes(racer.savedCar.record),
    },
  }
}

// A racer's rig: the model objects, with the drawings a viewer extension has for the racer's car and driver (each complete or not
// at all) following them. A racer index of null is a car the extensions know nothing about.
const createRacerRig = (
  assets: RaceAssets,
  racerIndex: number | null,
  parts: RacerModelObjects,
  host: ThreeScene
): RacerRig => {
  const carRequest = racerIndex === null ? null : getCarRequest(assets, racerIndex)
  const driverRequest = racerIndex === null ? null : getDriverRequest(assets, racerIndex)
  const carLink = carRequest === null ? null : attachCarDrawing(parts, carRequest, host)
  const driverLink =
    driverRequest === null || parts.driver === null
      ? null
      : attachDriverDrawing(parts.driver, driverRequest, host)
  const wheels = carLink?.wheels ?? parts.wheels
  const body = carLink === null ? parts.body : carLink.body
  const driver = driverLink?.driver ?? parts.driver
  return {
    wheels,
    body,
    driver,
    sync: (opacity) => {
      carLink?.sync(opacity)
      driverLink?.sync(opacity)
    },
    objects: [wheels, body, driver]
      .filter((part): part is ModelObject => part !== null)
      .map((part) => part.object),
  }
}

const createGhostRig = (
  assets: RaceAssets,
  racerIndex: number | null,
  parts: RacerModelObjects,
  host: ThreeScene
): RacerRig => {
  const present = [parts.wheels, parts.body, parts.driver].filter(
    (part): part is ModelObject => part !== null
  )
  for (const part of present) {
    part.group.visible = false
    setAlphaOverride(part.group, GHOST_ALPHA)
  }
  return createRacerRig(assets, racerIndex, parts, host)
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
  const trackKey =
    assets.scene.instances.find((instance) => instance.kind === SceneInstanceKind.BSP_TREE)
      ?.worldPath ?? ''
  // A mirrored race (Race_LoadTrackContent's flag) negates y in every loader; the world's instances sit where the
  // simulation puts them, so the track is drawn as its mirror image. three.js flips the faces of a mirrored object.
  if (assets.definition.isMirrored) shown.track.group.scale.set(1, -1, 1)
  trackScene.add(shown.track.group)
  const particles = createRaceParticles([assets.scene, assets.effectModels.materials])
  const decals = createRaceDecals(trackScene, assets, assets.definition.isMirrored)
  trackScene.add(particles.group)
  if (shown.backdrop !== null) backgroundScene.add(shown.backdrop.group)
  if (shown.sky !== null) backgroundScene.add(shown.sky.mesh)
  const racerRigs = assets.racerModels.map((models, racerIndex): RacerRig => {
    const rig = createRacerRig(
      assets,
      racerIndex,
      {
        wheels: createModelObject(models.wheels),
        body: models.body === null ? null : createModelObject(models.body),
        driver: models.driver === null ? null : createModelObject(models.driver),
      },
      trackScene
    )
    for (const part of [rig.wheels, rig.body, rig.driver]) {
      if (part !== null) trackScene.add(part.group)
    }
    return rig
  })

  // The ghost cars of a time trial: the champion's from GHOST.WDB, the session's best run with the player's own car models.
  const getGhostPart = (ghostScene: Scene, instanceName: string): ModelObject => {
    const object = createSceneObject(ghostScene, {
      includeInstance: (instance) =>
        instance.worldPath === GHOST_WORLD_PATH && instance.name === instanceName,
      isBackground: false,
    })
    const group = new Group()
    group.matrixAutoUpdate = false
    const scaled = new Group()
    scaled.scale.setScalar(assets.ghostScales[instanceName] ?? 1)
    scaled.add(object.group)
    group.add(scaled)
    return { group, object }
  }
  const playerModels = assets.racerModels[0]
  const ghostRigs: Readonly<Record<GhostCar['kind'], RacerRig | null>> = {
    champion:
      assets.ghostScene === null
        ? null
        : createGhostRig(
            assets,
            null,
            {
              wheels: getGhostPart(assets.ghostScene, 'ghost2'),
              body: getGhostPart(assets.ghostScene, 'ghostb2'),
              driver: getGhostPart(assets.ghostScene, 'ghostdr'),
            },
            trackScene
          ),
    best:
      assets.ghostScene === null || playerModels === undefined
        ? null
        : createGhostRig(
            assets,
            0,
            {
              wheels: createModelObject(playerModels.wheels),
              body: playerModels.body === null ? null : createModelObject(playerModels.body),
              driver: playerModels.driver === null ? null : createModelObject(playerModels.driver),
            },
            trackScene
          ),
  }
  for (const rig of Object.values(ghostRigs)) {
    if (rig === null) continue
    for (const part of [rig.wheels, rig.body, rig.driver])
      if (part !== null) trackScene.add(part.group)
  }

  // The wheels sit in the display frame; the car model at its position with the leaned rotation of the model frame
  // (vehicle +0x3c); the driver at the seat carried by that frame (LEGORacers.exe 0x0043e740).
  const colourShiftKeys = new Map<number, string>()
  const effects = createRaceEffects(trackScene, assets.effectModels)
  const screenFadeOverlay = createScreenFadeOverlay()
  // 0x0045d940: while the player is carried the tunnel and the car are drawn and the track is not. The tunnel is made
  // anew when a warp starts, so its clocks start at 0, and is advanced to the time spent in the warp.
  const warpGroup = new Group()
  warpGroup.visible = false
  trackScene.add(warpGroup)
  let tunnel: SceneObject | null = null
  let tunnelMilliseconds = 0
  const setWarpTunnel = (warpView: WarpView | null) => {
    if (warpView === null) {
      if (tunnel !== null) {
        warpGroup.remove(tunnel.group)
        tunnel.dispose()
        tunnel = null
      }
      warpGroup.visible = false
      return
    }
    if (tunnel === null || warpView.tunnelMilliseconds < tunnelMilliseconds) {
      if (tunnel !== null) {
        warpGroup.remove(tunnel.group)
        tunnel.dispose()
      }
      tunnel = createSceneObject(assets.effectModels.warpTunnel, {
        includeInstance: (instance) => instance.worldPath === WARP_WORLD_PATH,
        isBackground: false,
      })
      warpGroup.add(tunnel.group)
      tunnelMilliseconds = 0
    }
    tunnel.animate(warpView.tunnelMilliseconds - tunnelMilliseconds)
    const [scrollU, scrollV] = assets.effectModels.warpTextureScroll
    tunnel.group.traverse((object) => {
      if (object.type !== 'Mesh') return
      const { map } = (object as Mesh).material as MeshBasicMaterial
      map?.offset.set(
        getWrappedFraction((scrollU * warpView.tunnelMilliseconds) / MILLISECONDS_PER_SECOND),
        getWrappedFraction((scrollV * warpView.tunnelMilliseconds) / MILLISECONDS_PER_SECOND)
      )
    })
    tunnelMilliseconds = warpView.tunnelMilliseconds
    warpGroup.visible = true
  }
  let lastCameraView: CameraView | null = null
  let lastSprites: readonly SpriteView[] = []
  let lastRibbons: readonly RibbonView[] = []
  const update = (
    allPoses: readonly RacerPose[],
    allCameraView: CameraView,
    effectViews: EffectViews,
    warpView: WarpView | null = null,
    ghostCars: readonly GhostCar[] = [],
    screenFades: readonly ScreenFadeView[] = [],
    fieldOfViewDegrees = ORIGINAL_FIELD_OF_VIEW_DEGREES
  ) => {
    screenFadeOverlay.update(screenFades)
    setWarpTunnel(warpView)
    shown.track.group.visible = warpView === null
    particles.group.visible = warpView === null
    backgroundScene.visible = warpView === null
    const poses =
      warpView === null
        ? allPoses
        : allPoses.map((pose) =>
            pose.racerIndex === warpView.pose.racerIndex ? warpView.pose : pose
          )
    const cameraView = warpView === null ? allCameraView : warpView.cameraView
    lastCameraView = cameraView
    lastSprites = warpView === null ? effectViews.sprites : []
    lastRibbons = warpView === null ? effectViews.ribbons : []
    effects.update(
      warpView === null
        ? effectViews
        : {
            ...effectViews,
            effects: [],
            bricks: [],
            explosions: [],
            attachments: [],
            sprites: [],
            ribbons: [],
          },
      cameraView.position,
      poses
    )
    for (const rig of racerRigs) {
      const isShown = warpView === null || rig === racerRigs[warpView.pose.racerIndex]
      for (const part of [rig.wheels, rig.body, rig.driver])
        if (part !== null) part.group.visible = isShown
    }
    decals.update(poses, cameraView.position)
    decals.updateEffects(warpView === null ? effectViews.decals : [], cameraView.position)
    decals.setPoses(allPoses)
    for (const pose of poses) {
      const racerRig = racerRigs[pose.racerIndex]
      if (racerRig === undefined) continue
      const shiftKey = JSON.stringify(pose.colourShift)
      if (colourShiftKeys.get(pose.racerIndex) !== shiftKey) {
        colourShiftKeys.set(pose.racerIndex, shiftKey)
        for (const object of racerRig.objects) object.setColourShift(pose.colourShift)
      }
      const isRigShown = warpView === null || pose.racerIndex === warpView.pose.racerIndex
      const centres = pose.partCentres
      const eye = cameraView.position
      racerRig.wheels.group.visible =
        isRigShown && getIsWithinLevelDistance(centres?.wheels ?? null, eye)
      if (racerRig.body !== null) {
        racerRig.body.group.visible =
          isRigShown && getIsWithinLevelDistance(centres?.body ?? null, eye)
      }
      if (racerRig.driver !== null) {
        racerRig.driver.group.visible =
          isRigShown && getIsWithinLevelDistance(centres?.driver ?? null, eye)
      }
      const partScale = new Matrix4().makeScale(pose.partScale, pose.partScale, pose.partScale)
      racerRig.wheels.group.matrix
        .copy(getFrameMatrix(pose.rotation, pose.position))
        .multiply(partScale)
      racerRig.wheels.group.matrixWorldNeedsUpdate = true
      racerRig.wheels.object.setAnimationState(pose.wheelAnimation)
      if (racerRig.body !== null) {
        racerRig.body.group.matrix
          .copy(getFrameMatrix(pose.bodyRotation, pose.position))
          .multiply(partScale)
        racerRig.body.group.matrixWorldNeedsUpdate = true
      }
      if (racerRig.driver !== null) {
        racerRig.driver.group.matrix
          .copy(getFrameMatrix(pose.bodyRotation, pose.driverPosition))
          .multiply(partScale)
        racerRig.driver.group.matrixWorldNeedsUpdate = true
        racerRig.driver.object.setAnimationState(pose.driverAnimation)
      }
      racerRig.sync(1)
    }
    for (const kind of ['champion', 'best'] as const) {
      const rig = ghostRigs[kind]
      if (rig === null) continue
      const car = ghostCars.find((candidate) => candidate.kind === kind)
      const isShown = car !== undefined && warpView === null
      for (const part of [rig.wheels, rig.body, rig.driver])
        if (part !== null) part.group.visible = isShown
      if (car === undefined) continue
      rig.wheels.group.matrix.copy(getFrameMatrix(car.rotation, car.position))
      rig.wheels.group.matrixWorldNeedsUpdate = true
      if (car.wheelAnimation !== null) rig.wheels.object.setAnimationState(car.wheelAnimation)
      if (rig.body !== null) {
        rig.body.group.matrix.copy(getFrameMatrix(car.rotation, car.position))
        rig.body.group.matrixWorldNeedsUpdate = true
      }
      if (rig.driver !== null) {
        rig.driver.group.matrix.copy(getFrameMatrix(car.rotation, car.driverPosition))
        rig.driver.group.matrixWorldNeedsUpdate = true
        if (car.driverAnimation !== null) rig.driver.object.setAnimationState(car.driverAnimation)
      }
      rig.sync(GHOST_OPACITY)
    }
    const { position, forward, up } = cameraView
    camera.fov = warpView === null ? fieldOfViewDegrees : warpView.fieldOfViewDegrees
    camera.updateProjectionMatrix()
    camera.position.set(position.x, position.y, position.z)
    // The engine's camera frames take a negated up vector (see the world's cameras).
    camera.up.set(-up.x, -up.y, -up.z)
    camera.lookAt(position.x + forward.x, position.y + forward.y, position.z + forward.z)
    const frustum = getCameraFrustum(camera)
    shown.track.selectLevels(camera.position, frustum)
    shown.track.selectVisibleLeaves(frustum)
    const placement = shown.sky?.place(camera.position)
    if (shown.backdrop !== null) {
      const point = placement?.backdrop ?? camera.position
      shown.backdrop.group.position.set(point.x, point.y, point.z)
    }
  }

  const showHazards = (worlds: RaceWorlds, pools: readonly (EmitterPool | null)[]) => {
    for (const world of [worlds.track, worlds.blended, worlds.local]) {
      for (const instance of world.skeletonInstances) {
        if (instance.clip !== null) shown.track.setSkeletonState(instance.name, instance.clip)
        const sphere = getSkeletonInstanceSphere(sphereArithmetic, instance)
        shown.track.setInstanceRuntime(instance.name, {
          position: getPosition(instance.position),
          levelSquaredDistances: instance.levelSquaredDistances,
          sphere:
            sphere === null
              ? null
              : {
                  centre: { x: sphere.centre[0], y: sphere.centre[1], z: sphere.centre[2] },
                  radius: sphere.radius,
                },
        })
      }
      for (const instance of world.meshInstances) {
        shown.track.setInstanceRuntime(instance.name, {
          position: getPosition(instance.position),
          levelSquaredDistances: instance.levelSquaredDistances,
          sphere: null,
        })
      }
    }
    if (lastCameraView !== null) particles.update(pools, lastCameraView, lastSprites, lastRibbons)
  }

  return Object.freeze({
    trackScene,
    trackGroup: shown.track.group,
    trackKey,
    backgroundScene,
    screenFadeOverlay,
    camera,
    racerRigs,
    update,
    showHazards,
    animate: (deltaMilliseconds: number) => {
      decals.step(deltaMilliseconds)
      shown.backdrop?.animate(deltaMilliseconds)
      shown.sky?.animate(deltaMilliseconds)
    },
    dispose: () => {
      particles.dispose()
      decals.dispose()
      shown.track.dispose()
      shown.backdrop?.dispose()
      shown.sky?.dispose()
      effects.dispose()
      screenFadeOverlay.dispose()
      for (const { objects } of racerRigs) for (const object of objects) object.dispose()
      for (const rig of Object.values(ghostRigs)) {
        if (rig !== null) for (const object of rig.objects) object.dispose()
      }
    },
  })
}

// The race drawn as the engine does (LEGORacers.exe 0x004357b0).
export const createRaceViewport = (
  container: HTMLElement,
  assets: RaceAssets,
  size: RaceStageSize,
  pixelRatio: number | null = null
): RaceViewport => {
  const renderer = new WebGLRenderer({ antialias: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(new Color(BACKGROUND_COLOR))
  renderer.autoClear = false
  if (pixelRatio !== null) renderer.setPixelRatio(pixelRatio)
  renderer.setSize(size.width, size.height)
  container.appendChild(renderer.domElement)
  const stage = createRaceStage(assets, size)
  const renderPasses = getRaceRenderPasses({
    renderer,
    camera: stage.camera,
    trackScene: stage.trackScene,
    trackGroup: stage.trackGroup,
    trackKey: stage.trackKey,
  })
  return Object.freeze({
    update: stage.update,
    showHazards: stage.showHazards,
    animate: stage.animate,
    resize: (nextSize) => {
      renderer.setSize(nextSize.width, nextSize.height)
      stage.camera.aspect = nextSize.width / nextSize.height
      stage.camera.updateProjectionMatrix()
    },
    render: () => {
      for (const pass of renderPasses) pass.beforeRender()
      renderer.clear()
      renderer.render(stage.backgroundScene, stage.camera)
      renderer.render(stage.trackScene, stage.camera)
      renderer.render(stage.screenFadeOverlay.scene, stage.screenFadeOverlay.camera)
    },
    dispose: () => {
      for (const pass of renderPasses) pass.dispose()
      stage.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  })
}
