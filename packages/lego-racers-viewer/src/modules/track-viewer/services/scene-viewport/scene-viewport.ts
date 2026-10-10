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
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { SceneViewport } from './scene-viewport.types.ts'

const FIELD_OF_VIEW_DEGREES = 60
const BACKGROUND_COLOR = 0x101820
// Fraction of the scene radius the fly keys move per second.
const FLY_SPEED = 0.35

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

// A WebGL view of a scene with orbit controls (drag, wheel) and WASD/QE flying.
export const createSceneViewport = (container: HTMLElement): SceneViewport => {
  const renderer = new WebGLRenderer({ antialias: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)
  const threeScene = new ThreeScene()
  threeScene.background = new Color(BACKGROUND_COLOR)
  const camera = new PerspectiveCamera(FIELD_OF_VIEW_DEGREES, 1, 1, 100000)
  camera.up.copy(WORLD_UP)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.zoomToCursor = true
  const pressedKeys = new Set<string>()
  let lastFrameTime: number | null = null
  let sceneObject: SceneObject | null = null
  let currentScene: Scene | null = null
  let sceneRadius = 100

  const resize = () => {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const frameScene = () => {
    const sphere =
      sceneObject?.bounds.isEmpty() === false
        ? sceneObject.bounds.getBoundingSphere(new Sphere())
        : null
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
    const worldCamera = cameraIndex === null ? undefined : currentScene?.cameras[cameraIndex]
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

  const showScene = (scene: Scene | null) => {
    if (sceneObject !== null) {
      threeScene.remove(sceneObject.group)
      sceneObject.dispose()
    }
    currentScene = scene
    sceneObject = scene === null ? null : createSceneObject(scene)
    if (sceneObject !== null) threeScene.add(sceneObject.group)
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

  const onKeyDown = (event: KeyboardEvent) => pressedKeys.add(event.code)
  const onKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()
  renderer.setAnimationLoop((time: number) => {
    fly(lastFrameTime === null ? 0 : (time - lastFrameTime) / 1000)
    lastFrameTime = time
    controls.update()
    renderer.render(threeScene, camera)
  })

  const dispose = () => {
    renderer.setAnimationLoop(null)
    resizeObserver.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    sceneObject?.dispose()
    controls.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return Object.freeze({ showScene, showCamera, dispose })
}
