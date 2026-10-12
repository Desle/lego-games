import {
  AmbientLight,
  Color,
  DoubleSide,
  CubeTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three'
import type { Material, Object3D } from 'three'
import type { StandardMesh } from './ldraw-plastic.types.ts'
import { PLASTIC_APPEARANCE } from './ldraw-plastic.constants.ts'

const ENVIRONMENT_FACE_SIZE = 64
const CUBE_FACE_COUNT = 6
const TOP_FACE_INDEX = 2
const BOTTOM_FACE_INDEX = 3

let environment: CubeTexture | null = null

const drawEnvironmentFace = (faceIndex: number): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas')
  canvas.width = ENVIRONMENT_FACE_SIZE
  canvas.height = ENVIRONMENT_FACE_SIZE
  const context = canvas.getContext('2d')
  if (context === null) return null
  const gradient = context.createLinearGradient(0, 0, 0, ENVIRONMENT_FACE_SIZE)
  if (faceIndex === TOP_FACE_INDEX) {
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(1, '#ffffff')
  } else if (faceIndex === BOTTOM_FACE_INDEX) {
    gradient.addColorStop(0, '#5d626b')
    gradient.addColorStop(1, '#5d626b')
  } else {
    gradient.addColorStop(0, '#f4f7fb')
    gradient.addColorStop(0.5, '#c3cad4')
    gradient.addColorStop(1, '#6c717b')
  }
  context.fillStyle = gradient
  context.fillRect(0, 0, ENVIRONMENT_FACE_SIZE, ENVIRONMENT_FACE_SIZE)
  if (faceIndex !== TOP_FACE_INDEX && faceIndex !== BOTTOM_FACE_INDEX) {
    // A soft box in each side wall: what gives the plastic its long highlights.
    context.fillStyle = '#ffffff'
    context.fillRect(ENVIRONMENT_FACE_SIZE * 0.18, 4, ENVIRONMENT_FACE_SIZE * 0.64, 14)
  }
  return canvas
}

// A small studio: bright ceiling and sky, a grey floor, a soft box on every wall. No file, nothing to load.
const getEnvironment = (): CubeTexture | null => {
  if (environment !== null) return environment
  const faces = Array.from({ length: CUBE_FACE_COUNT }, (_, faceIndex) =>
    drawEnvironmentFace(faceIndex)
  )
  if (faces.some((face) => face === null)) return null
  const texture = new CubeTexture(faces.filter((face) => face !== null))
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  environment = texture
  return texture
}

const softenEdges = (materials: ReadonlySet<LineBasicMaterial>) => {
  for (const material of materials) {
    material.transparent = true
    material.opacity = PLASTIC_APPEARANCE.edgeOpacity
    material.color.lerp(new Color(0x000000), PLASTIC_APPEARANCE.edgeDarkening)
  }
}

const createPlasticMaterial = (source: MeshStandardMaterial): MeshPhysicalMaterial => {
  const isMetal = source.metalness > 0.5
  const material = new MeshPhysicalMaterial({
    color: source.color,
    roughness: isMetal ? source.roughness : PLASTIC_APPEARANCE.roughness,
    metalness: source.metalness,
    clearcoat: isMetal ? 0 : PLASTIC_APPEARANCE.clearcoat,
    clearcoatRoughness: PLASTIC_APPEARANCE.clearcoatRoughness,
    envMap: getEnvironment(),
    envMapIntensity: PLASTIC_APPEARANCE.environmentIntensity,
    transparent: source.transparent,
    opacity: source.opacity,
    depthWrite: source.depthWrite,
    side: source.side,
    polygonOffset: source.polygonOffset,
    polygonOffsetFactor: source.polygonOffsetFactor,
    polygonOffsetUnits: source.polygonOffsetUnits,
    vertexColors: source.vertexColors,
  })
  material.name = source.name
  return material
}

// The library hands out plain standard materials; the cars get glossy moulded plastic (a clear coat over a smooth base, a studio
// reflected in it) and quiet edge lines: crisp enough to read the bricks at race distance, never loud.
const getIsStandardMesh = (object: Object3D): object is StandardMesh =>
  object instanceof Mesh && object.material instanceof MeshStandardMaterial

export const createPlasticMaterialFromColor = (color: number): MeshPhysicalMaterial =>
  createPlasticMaterial(new MeshStandardMaterial({ color, side: DoubleSide }))

const isConditionalLineMaterial = (material: unknown): material is LineBasicMaterial =>
  material instanceof Object && Reflect.get(material, 'isConditionalLineMaterial') === true

export const applyPlasticLook = (model: Object3D) => {
  const plasticBySource = new Map<Material, MeshPhysicalMaterial>()
  const edgeMaterials = new Set<LineBasicMaterial>()
  const meshes: StandardMesh[] = []
  model.traverse((child) => {
    if (getIsStandardMesh(child)) {
      meshes.push(child)
      return
    }
    const lineMaterials: unknown = Reflect.get(child, 'material')
    for (const material of Array.isArray(lineMaterials) ? lineMaterials : [lineMaterials]) {
      if (material instanceof LineBasicMaterial || isConditionalLineMaterial(material))
        edgeMaterials.add(material)
    }
  })
  for (const mesh of meshes) {
    const plastic = plasticBySource.get(mesh.material) ?? createPlasticMaterial(mesh.material)
    plasticBySource.set(mesh.material, plastic)
    mesh.material = plastic
  }
  softenEdges(edgeMaterials)
}

// Key light from above and the front left, a cooler fill from the right, a sky and ground tint, and the studio in the plastic.
// The lights live in the car's frame (z up) and aim at its origin, so a car looks the same wherever it is.
export const createStudioLights = (): Group => {
  const lights = new Group()
  const key = new DirectionalLight(0xfff4e6, PLASTIC_APPEARANCE.keyIntensity)
  key.position.set(-40, -70, 100)
  const fill = new DirectionalLight(0xdbe8ff, PLASTIC_APPEARANCE.fillIntensity)
  fill.position.set(90, 50, 30)
  const rim = new DirectionalLight(0xffffff, PLASTIC_APPEARANCE.rimIntensity)
  rim.position.set(20, 90, 50)
  const hemisphere = new HemisphereLight(0xffffff, 0x8a8f99, PLASTIC_APPEARANCE.hemisphereIntensity)
  hemisphere.position.set(0, 0, 100)
  hemisphere.up.set(0, 0, 1)
  lights.add(
    new AmbientLight(0xffffff, PLASTIC_APPEARANCE.ambientIntensity),
    hemisphere,
    key,
    key.target,
    fill,
    fill.target,
    rim,
    rim.target
  )
  return lights
}
