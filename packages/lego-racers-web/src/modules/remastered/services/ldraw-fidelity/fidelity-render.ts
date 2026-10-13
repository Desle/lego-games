import {
  Box3,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Sphere,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import type { Material, Object3D, Scene, WebGLRenderer } from 'three'
import { FidelityView } from './ldraw-fidelity.types.ts'
import type { DrawnMesh, FidelityPair, ViewFrame, ViewPictures } from './fidelity-render.types.ts'

const CHANNELS = 4
const SILHOUETTE_COLOR = 0xffffff
const FRAME_MARGIN = 1.05
const CAMERA_DISTANCE_RADII = 3
// The camera looks from these directions at the pair, with these up directions on the picture: the front from ahead (+x), the side from
// the left (+y), the top from above with the front up the picture, three quarters from ahead, the left and above.
const VIEW_FRAMES: Readonly<Record<FidelityView, ViewFrame>> = Object.freeze({
  [FidelityView.FRONT]: { direction: [1, 0, 0], up: [0, 0, 1] },
  [FidelityView.SIDE]: { direction: [0, 1, 0], up: [0, 0, 1] },
  [FidelityView.TOP]: { direction: [0, 0, 1], up: [1, 0, 0] },
  [FidelityView.THREE_QUARTER]: { direction: [1, 1, 0.8], up: [0, 0, 1] },
})

const getIsMesh = (object: Object3D): object is DrawnMesh => object instanceof Mesh

export const getMeshes = (root: Object3D, isVisibleOnly: boolean): readonly DrawnMesh[] => {
  const meshes: DrawnMesh[] = []
  const visit = (child: Object3D) => {
    if (getIsMesh(child)) meshes.push(child)
  }
  if (isVisibleOnly) root.traverseVisible(visit)
  else root.traverse(visit)
  return meshes
}

const silhouetteMaterial = new MeshBasicMaterial({ color: SILHOUETTE_COLOR, side: DoubleSide })

// The bounds of what a scene draws (visible meshes only, every vertex where it is now: posed skeletons included), in the world.
export const getVisibleBounds = (object: Object3D): Box3 => {
  object.updateMatrixWorld(true)
  const bounds = new Box3()
  const point = new Vector3()
  for (const child of getMeshes(object, true)) {
    if (!child.geometry.hasAttribute('position')) continue
    const positions = child.geometry.getAttribute('position')
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      bounds.expandByPoint(
        point.fromBufferAttribute(positions, vertex).applyMatrix4(child.matrixWorld)
      )
    }
  }
  return bounds
}

const getIsLine = (object: Object3D): boolean =>
  Reflect.get(object, 'isLineSegments') === true || Reflect.get(object, 'isLine') === true

// What is measured is the shape and the colour: edge lines are hidden, and a model in two details shows its plain-stud one (the logo
// studs change no silhouette, and the switch would pick by the camera's distance, which the orthographic views do not have).
export const prepareForMeasuring = (scene: Scene) =>
  scene.traverse((child) => {
    if (getIsLine(child)) Object.assign(child, { visible: false })
    const getLevels: unknown = Reflect.get(child, 'getLevels')
    if (typeof getLevels !== 'function') return
    const [low, high] = (getLevels as () => readonly (Object3D | null)[]).call(child)
    Object.assign(child, { autoUpdate: false })
    if (low !== null && low !== undefined) Object.assign(low, { visible: true })
    if (high !== null && high !== undefined) Object.assign(high, { visible: false })
  })

const getFlatMaterial = (material: Material): MeshBasicMaterial => {
  const color: unknown = Reflect.get(material, 'color')
  const map: unknown = Reflect.get(material, 'map')
  return new MeshBasicMaterial({
    color: color instanceof Color ? color : new Color(SILHOUETTE_COLOR),
    map: map === null || map === undefined ? null : (map as MeshBasicMaterial['map']),
    vertexColors: material.vertexColors,
    side: material.side,
    alphaTest: material.alphaTest,
  })
}

// Runs a render with every mesh of the replacement in a flat material of its colour and picture (no lights, no look), then puts the
// materials back.
const withFlatMaterials = (scene: Scene, render: () => void) => {
  const kept = new Map<Mesh, Material | Material[]>()
  const made: MeshBasicMaterial[] = []
  for (const mesh of getMeshes(scene, false)) {
    const material = mesh.material
    kept.set(mesh, material)
    const flat = Array.isArray(material) ? material.map(getFlatMaterial) : getFlatMaterial(material)
    made.push(...(Array.isArray(flat) ? flat : [flat]))
    mesh.material = flat
  }
  render()
  for (const [mesh, material] of kept) mesh.material = material
  for (const material of made) material.dispose()
}

// An orthographic camera framed on `frame` (the picture spans its sphere), far enough back that everything of `whole` lies in front
// of it, so a framed part of a figure is not cut by the near plane.
const createCamera = (view: FidelityView, frame: Sphere, whole: Sphere): OrthographicCamera => {
  const radius = frame.radius * FRAME_MARGIN
  const distance = frame.center.distanceTo(whole.center) + whole.radius * CAMERA_DISTANCE_RADII
  const camera = new OrthographicCamera(-radius, radius, radius, -radius, 0, distance * 2)
  const { direction, up } = VIEW_FRAMES[view]
  camera.up.set(...up)
  camera.position
    .copy(frame.center)
    .addScaledVector(new Vector3(...direction).normalize(), distance)
  camera.lookAt(frame.center)
  camera.updateMatrixWorld(true)
  return camera
}

const getAxis = (camera: OrthographicCamera, column: number): [number, number, number] => {
  const axis = new Vector3().setFromMatrixColumn(camera.matrixWorld, column).normalize()
  return [axis.x, axis.y, axis.z]
}

// Every view of the pair: one orthographic camera per view, framed on `frame` (both drawings together, or the region of a part), a
// silhouette pass (white, both sides of every face) and a flat colour pass of each, read back at `size` x `size` pixels without
// antialiasing.
export const renderPairViews = (
  renderer: WebGLRenderer,
  pair: FidelityPair,
  size: number,
  frame: Box3 | null
): readonly ViewPictures[] => {
  const whole = getVisibleBounds(pair.original)
    .union(getVisibleBounds(pair.replacement))
    .getBoundingSphere(new Sphere())
  const sphere = frame === null ? whole : frame.getBoundingSphere(new Sphere())
  const target = new WebGLRenderTarget(size, size)
  const read = (scene: Scene, camera: OrthographicCamera): Uint8Array => {
    const pixels = new Uint8Array(size * size * CHANNELS)
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
    return pixels
  }
  const readSilhouette = (scene: Scene, camera: OrthographicCamera): Uint8Array => {
    Object.assign(scene, { overrideMaterial: silhouetteMaterial })
    const pixels = read(scene, camera)
    Object.assign(scene, { overrideMaterial: null })
    return pixels
  }
  const pictures = Object.values(FidelityView).map((view): ViewPictures => {
    const camera = createCamera(view, sphere, whole)
    let replacementColor: Uint8Array = new Uint8Array(0)
    withFlatMaterials(pair.replacement, () => {
      replacementColor = read(pair.replacement, camera)
    })
    return Object.freeze({
      view,
      size,
      pixelSize: (camera.right - camera.left) / size,
      right: getAxis(camera, 0),
      up: getAxis(camera, 1),
      originalSilhouette: readSilhouette(pair.original, camera),
      replacementSilhouette: readSilhouette(pair.replacement, camera),
      originalColor: read(pair.original, camera),
      replacementColor,
    })
  })
  renderer.setRenderTarget(null)
  target.dispose()
  return pictures
}
