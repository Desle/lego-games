import { Mesh, Scene } from 'three'
import type { Material, Object3D, WebGLRenderer } from 'three'
import type { HookCall } from './hd-coverage.types.ts'
import type {
  FrameDrawer,
  OnScreenDrawing,
  OnScreenFrame,
  OnScreenMaterialGroup,
  VisibleLayerDrawing,
} from './on-screen-check.types.ts'

// A channel that moves by more than this is a changed pixel (anti-aliasing and dithering stay below it).
const CHANNEL_TOLERANCE = 4
const CHANNELS_PER_PIXEL = 4

const readPixels = (canvas: HTMLCanvasElement): Uint8ClampedArray => {
  const { width, height } = canvas
  const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('No 2D context to read the frame with')
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, width, height).data
}

const getChangedPixels = (before: Uint8ClampedArray, after: Uint8ClampedArray): number => {
  if (before.length !== after.length) return before.length / CHANNELS_PER_PIXEL
  let changed = 0
  for (let pixel = 0; pixel < before.length; pixel += CHANNELS_PER_PIXEL) {
    for (let channel = 0; channel < CHANNELS_PER_PIXEL; channel++) {
      if (
        Math.abs((before[pixel + channel] ?? 0) - (after[pixel + channel] ?? 0)) > CHANNEL_TOLERANCE
      ) {
        changed += 1
        break
      }
    }
  }
  return changed
}

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

const getMaterials = (mesh: Mesh): readonly Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material]

const getIsPictured = (mesh: Mesh): boolean =>
  getMaterials(mesh).some((material) => 'map' in material && material.map !== null)

const getMaterialKey = (mesh: Mesh): string =>
  getMaterials(mesh)
    .map((material) => material.type)
    .join('+')

const drainErrors = (renderers: ReadonlySet<WebGLRenderer>): readonly number[] =>
  [...renderers].flatMap((renderer) => {
    const context = renderer.getContext()
    const errors: number[] = []
    for (let error = context.getError(); error !== context.NO_ERROR; error = context.getError())
      errors.push(error)
    return errors
  })

// Hides the objects, draws the frame and reads it, then gives them back their visibility.
const drawWithout = (objects: readonly Object3D[], drawFrame: FrameDrawer) => {
  const visibilities = objects.map((object) => object.visible)
  for (const object of objects) object.visible = false
  const pixels = readPixels(drawFrame())
  for (const [index, object] of objects.entries()) object.visible = visibilities[index] ?? true
  return pixels
}

// Measures whether the layer's drawings reach the screen, not only the scene: every frame it measures is drawn again with each
// drawing, and each of its material groups, hidden in turn, and the WebGL errors of its renderers are read. A draw WebGL refuses
// (a shadow sampler bound to a colour texture) leaves the scene whole and the screen without the plastic.
export const createOnScreenCheck = (
  getCalls: () => readonly HookCall[],
  getCallId: (object: Object3D) => number | null
) => {
  let renderers = new Set<WebGLRenderer>()
  let scenes = new Set<Scene>()
  let isWatching = false
  // The census's hook comes first and reads no `this`.
  const previousOnBeforeRender = Scene.prototype.onBeforeRender.bind(Scene.prototype)
  Scene.prototype.onBeforeRender = (...parameters) => {
    previousOnBeforeRender(...parameters)
    if (!isWatching) return
    const [renderer, scene] = parameters
    renderers = new Set(renderers).add(renderer)
    if (scene instanceof Scene) scenes = new Set(scenes).add(scene)
  }

  const getDrawings = () => {
    const calls = getCalls()
    const found: VisibleLayerDrawing[] = []
    const visit = (object: Object3D) => {
      if (!object.visible) return
      const callId = getCallId(object)
      const call = calls.find((candidate) => candidate.id === callId)
      if (call !== undefined) found.push({ call, object })
      object.children.forEach(visit)
    }
    scenes.forEach(visit)
    return found
  }

  // The visible meshes of a drawing, without those of a drawing inside it (a driver in a car is its own drawing).
  const getMeshes = (drawing: Object3D): readonly Mesh[] => {
    const meshes: Mesh[] = []
    const visit = (object: Object3D) => {
      if (!object.visible || (object !== drawing && getCallId(object) !== null)) return
      if (getIsMesh(object)) meshes.push(object)
      object.children.forEach(visit)
    }
    visit(drawing)
    return meshes
  }

  const measureGroups = (
    meshes: readonly Mesh[],
    shown: Uint8ClampedArray,
    drawFrame: FrameDrawer
  ): readonly OnScreenMaterialGroup[] => {
    const keys = [
      ...new Set(meshes.map((mesh) => `${getMaterialKey(mesh)}|${String(getIsPictured(mesh))}`)),
    ].sort()
    return keys.map((key) => {
      const members = meshes.filter(
        (mesh) => `${getMaterialKey(mesh)}|${String(getIsPictured(mesh))}` === key
      )
      const first = members[0]
      return {
        material: first === undefined ? key : getMaterialKey(first),
        isPictured: first !== undefined && getIsPictured(first),
        meshCount: members.length,
        changedPixels: getChangedPixels(shown, drawWithout(members, drawFrame)),
      }
    })
  }

  const measure = (label: string, drawFrame: FrameDrawer): OnScreenFrame => {
    renderers = new Set()
    scenes = new Set()
    isWatching = true
    const shown = readPixels(drawFrame())
    isWatching = false
    const errorsBefore = drainErrors(renderers)
    const unchangedDifference = getChangedPixels(shown, readPixels(drawFrame()))
    // The meshes are hidden, not the drawing: a view shows its drawing again on every draw.
    const drawings = getDrawings().map(({ call, object }): OnScreenDrawing => {
      const meshes = getMeshes(object)
      return {
        callId: call.id,
        hook: call.hook,
        key: call.key,
        changedPixels: getChangedPixels(shown, drawWithout(meshes, drawFrame)),
        groups: measureGroups(meshes, shown, drawFrame),
      }
    })
    return {
      label,
      webglErrors: [...errorsBefore, ...drainErrors(renderers)],
      unchangedDifference,
      drawings,
    }
  }

  return { measure }
}
