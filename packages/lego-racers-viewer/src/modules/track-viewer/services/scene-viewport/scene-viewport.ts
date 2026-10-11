import type { Scene } from '@lego-games/lego-racers/scene'
import {
  Color,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene as ThreeScene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createSceneObject } from '../scene-object/scene-object.ts'
import { createSkyObject } from '../sky-object/sky-object.ts'
import type { SceneBackground } from '../../types/track-viewer.types.ts'
import type { SceneViewport, ShownScene } from './scene-viewport.types.ts'

const FIELD_OF_VIEW_DEGREES = 60
const BACKGROUND_COLOR = 0x101820
// Fraction of the scene radius the fly keys move per second.
const FLY_SPEED = 0.35
// The engine caps a frame at 100 milliseconds (LEGORacers.exe 0x00416ef0, maximum delta 0x004162c0).
const MAXIMUM_FRAME_MILLISECONDS = 100

// The engine's worlds are Z-up (default instance up (0, 0, 1), GolDP.dll 0x1002cc30).
const WORLD_UP = new Vector3(0, 0, 1)

const FLY_DIRECTIONS: Readonly<Record<string, readonly [number, number, number]>> = {
  KeyW: [0, 0, -1],
  KeyS: [0, 0, 1],
  KeyA: [-1, 0, 0],
  KeyD: [1, 0, 0],
  KeyE: [0, 1, 0],
  KeyQ: [0, -1, 0],
}

export const showSceneObjects = (scene: Scene, background: SceneBackground | null): ShownScene => {
  const backgroundPath = background?.backgroundWorldPath ?? null
  return Object.freeze({
    scene,
    track: createSceneObject(scene, {
      includeInstance: (instance) => instance.worldPath !== backgroundPath,
      isBackground: false,
    }),
    backdrop:
      backgroundPath === null
        ? null
        : createSceneObject(scene, {
            includeInstance: (instance) => instance.worldPath === backgroundPath,
            isBackground: true,
          }),
    sky: background?.sky == null ? null : createSkyObject(background.sky, scene),
  })
}

// A WebGL view of a scene with orbit controls (drag, wheel) and WASD/QE flying. As the engine draws a race
// (LEGORacers.exe 0x004357b0), the sky and the background world come first with the depth test off, then the
// track.
export const createSceneViewport = (container: HTMLElement): SceneViewport => {
  const renderer = new WebGLRenderer({ antialias: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(new Color(BACKGROUND_COLOR))
  renderer.autoClear = false
  container.appendChild(renderer.domElement)
  const trackScene = new ThreeScene()
  const backgroundScene = new ThreeScene()
  const camera = new PerspectiveCamera(FIELD_OF_VIEW_DEGREES, 1, 1, 100000)
  camera.up.copy(WORLD_UP)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.zoomToCursor = true
  const pressedKeys = new Set<string>()
  let lastFrameTime: number | null = null
  let shown: ShownScene | null = null
  let sceneRadius = 100
  let isPlaying = true
  let pendingMilliseconds = 0

  const resize = () => {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const frameScene = () => {
    const bounds = shown?.track.bounds
    const sphere = bounds?.isEmpty() === false ? bounds.getBoundingSphere(new Sphere()) : null
    const center = sphere?.center ?? new Vector3()
    sceneRadius = Math.max(sphere?.radius ?? 100, 1)
    camera.near = sceneRadius / 1000
    camera.far = sceneRadius * 20
    camera.updateProjectionMatrix()
    camera.position.copy(center).add(new Vector3(sceneRadius, -sceneRadius, sceneRadius * 0.8))
    controls.target.copy(center)
    controls.update()
  }

  const showCamera = (cameraIndex: number | null) => {
    const worldCamera = cameraIndex === null ? undefined : shown?.scene.cameras[cameraIndex]
    if (worldCamera === undefined) {
      frameScene()
      return
    }
    const { position, forward } = worldCamera
    camera.position.set(position.x, position.y, position.z)
    const forwardVector = new Vector3(forward.x, forward.y, forward.z).normalize()
    controls.target.copy(camera.position).addScaledVector(forwardVector, sceneRadius / 10)
    controls.update()
  }

  const hideScene = () => {
    if (shown === null) return
    trackScene.remove(shown.track.group)
    shown.track.dispose()
    if (shown.backdrop !== null) {
      backgroundScene.remove(shown.backdrop.group)
      shown.backdrop.dispose()
    }
    if (shown.sky !== null) {
      backgroundScene.remove(shown.sky.mesh)
      shown.sky.dispose()
    }
    shown = null
  }

  const showScene = (scene: Scene | null, background: SceneBackground | null) => {
    hideScene()
    if (scene !== null) {
      shown = showSceneObjects(scene, background)
      trackScene.add(shown.track.group)
      if (shown.backdrop !== null) backgroundScene.add(shown.backdrop.group)
      if (shown.sky !== null) backgroundScene.add(shown.sky.mesh)
    }
    frameScene()
  }

  const fly = (seconds: number) => {
    const step = new Vector3()
    for (const key of pressedKeys) {
      const [right, up, back] = FLY_DIRECTIONS[key] ?? [0, 0, 0]
      step.add(new Vector3(right, up, back))
    }
    if (step.lengthSq() === 0) return
    step
      .normalize()
      .multiplyScalar(sceneRadius * FLY_SPEED * seconds)
      .applyQuaternion(camera.quaternion)
    camera.position.add(step)
    controls.target.add(step)
  }

  // The animations take whole milliseconds, like the engine's frame delta.
  const animate = (seconds: number) => {
    if (shown === null || !isPlaying) return
    pendingMilliseconds += Math.min(seconds * 1000, MAXIMUM_FRAME_MILLISECONDS)
    const wholeMilliseconds = Math.floor(pendingMilliseconds)
    if (wholeMilliseconds === 0) return
    pendingMilliseconds -= wholeMilliseconds
    shown.track.animate(wholeMilliseconds)
    shown.backdrop?.animate(wholeMilliseconds)
    shown.sky?.animate(wholeMilliseconds)
  }

  // The dome and the background world's instances follow the camera (0x0041d040).
  const placeBackground = () => {
    const placement = shown?.sky?.place(camera.position)
    if (shown?.backdrop == null) return
    const point = placement?.backdrop ?? camera.position
    shown.backdrop.group.position.set(point.x, point.y, point.z)
  }

  const onKeyDown = (event: KeyboardEvent) => pressedKeys.add(event.code)
  const onKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()
  renderer.setAnimationLoop((time: number) => {
    const seconds = lastFrameTime === null ? 0 : (time - lastFrameTime) / 1000
    fly(seconds)
    animate(seconds)
    lastFrameTime = time
    controls.update()
    placeBackground()
    renderer.clear()
    renderer.render(backgroundScene, camera)
    renderer.render(trackScene, camera)
  })

  const dispose = () => {
    renderer.setAnimationLoop(null)
    resizeObserver.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    hideScene()
    controls.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return Object.freeze({
    showScene,
    showCamera,
    setIsAnimationPlaying: (isNowPlaying: boolean) => {
      isPlaying = isNowPlaying
    },
    dispose,
  })
}
