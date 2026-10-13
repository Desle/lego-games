import type { Object3D } from 'three'
import {
  Box3,
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ModelViewerStats } from '../../types/model-viewer.types.ts'
import type { ModelStage } from './model-stage.types.ts'

const BACKGROUND_COLOR = 0x2b3340
const FIELD_OF_VIEW = 32
const VIEW_DIRECTION = new Vector3(0.6, 0.55, 1).normalize()
const FRAME_MARGIN = 1.3

export const createModelStage = (canvas: HTMLCanvasElement): ModelStage => {
  // The looks are tuned without colour management, as every LDraw page of the ports draws them.
  ColorManagement.enabled = false
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(new Color(BACKGROUND_COLOR))
  renderer.setPixelRatio(window.devicePixelRatio)
  const scene = new Scene()
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 2000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  let shownModel: Object3D | null = null

  const frameModel = (model: Object3D) => {
    model.updateMatrixWorld(true)
    const sphere = new Box3().setFromObject(model).getBoundingSphere(new Sphere())
    const radius = Math.max(sphere.radius, 1)
    const distance = (radius * FRAME_MARGIN) / Math.sin((FIELD_OF_VIEW * Math.PI) / 360)
    camera.near = radius / 100
    camera.far = radius * 40
    camera.position.copy(sphere.center).addScaledVector(VIEW_DIRECTION, distance)
    controls.target.copy(sphere.center)
    controls.update()
  }

  const setModel = (model: Object3D | null, isFramed: boolean) => {
    if (shownModel !== null) scene.remove(shownModel)
    shownModel = model
    if (model === null) return
    scene.add(model)
    if (isFramed) frameModel(model)
  }

  const draw = (): ModelViewerStats => {
    const width = Math.max(canvas.clientWidth, 1)
    const height = Math.max(canvas.clientHeight, 1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    controls.update()
    renderer.render(scene, camera)
    return Object.freeze({
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    })
  }

  const dispose = () => {
    setModel(null, false)
    controls.dispose()
    renderer.dispose()
  }

  return Object.freeze({ setModel, draw, dispose })
}
