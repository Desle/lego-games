import {
  AdditiveBlending,
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
import type { Material, Object3D, Texture } from 'three'
import type { StandardMesh } from './ldraw-plastic.types.ts'
import { PLASTIC_APPEARANCE } from './ldraw-plastic.constants.ts'
import { getActiveLook } from './ldraw-look.ts'
import type { LookAppearance } from './ldraw-look.types.ts'
import { applyLookShader, getLookNeedsShader } from './ldraw-look-shader.ts'
import { bakeOcclusionVolume } from './ldraw-occlusion.ts'
import type { OcclusionVolume } from './ldraw-occlusion.types.ts'

// The decals are colour-keyed pictures: a keyed pixel has alpha 0.
const DECAL_ALPHA_TEST = 0.5
const ENVIRONMENT_FACE_SIZE = 64
const CUBE_FACE_COUNT = 6
const TOP_FACE_INDEX = 2
const BOTTOM_FACE_INDEX = 3

const environments = new Map<boolean, CubeTexture>()

const drawEnvironmentFace = (faceIndex: number, isStudio: boolean): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas')
  canvas.width = ENVIRONMENT_FACE_SIZE
  canvas.height = ENVIRONMENT_FACE_SIZE
  const context = canvas.getContext('2d')
  if (context === null) return null
  const gradient = context.createLinearGradient(0, 0, 0, ENVIRONMENT_FACE_SIZE)
  if (isStudio) {
    // A dim room with bright lights in it: the contrast is what makes the clear coat read as glossy.
    gradient.addColorStop(0, faceIndex === BOTTOM_FACE_INDEX ? '#3a3f48' : '#8b919c')
    gradient.addColorStop(1, faceIndex === BOTTOM_FACE_INDEX ? '#3a3f48' : '#1b1e24')
  } else if (faceIndex === TOP_FACE_INDEX) {
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
  if (isStudio && faceIndex === TOP_FACE_INDEX) {
    context.fillStyle = '#ffffff'
    context.fillRect(
      ENVIRONMENT_FACE_SIZE * 0.15,
      ENVIRONMENT_FACE_SIZE * 0.15,
      ENVIRONMENT_FACE_SIZE * 0.7,
      ENVIRONMENT_FACE_SIZE * 0.7
    )
  }
  if (faceIndex !== TOP_FACE_INDEX && faceIndex !== BOTTOM_FACE_INDEX) {
    // A soft box in each side wall: what gives the plastic its long highlights.
    context.fillStyle = '#ffffff'
    context.fillRect(ENVIRONMENT_FACE_SIZE * 0.18, 4, ENVIRONMENT_FACE_SIZE * 0.64, 14)
    if (isStudio) {
      // Tall strip lights beside the wide one: the long, clean highlights of product photography.
      context.fillRect(ENVIRONMENT_FACE_SIZE * 0.06, 20, 5, ENVIRONMENT_FACE_SIZE * 0.5)
      context.fillRect(ENVIRONMENT_FACE_SIZE * 0.88, 20, 5, ENVIRONMENT_FACE_SIZE * 0.5)
    }
  }
  return canvas
}

// A small studio: bright ceiling and sky, a grey floor, a soft box on every wall. No file, nothing to load.
const getEnvironment = (isStudio: boolean): CubeTexture | null => {
  const existing = environments.get(isStudio)
  if (existing !== undefined) return existing
  const faces = Array.from({ length: CUBE_FACE_COUNT }, (_, faceIndex) =>
    drawEnvironmentFace(faceIndex, isStudio)
  )
  if (faces.some((face) => face === null)) return null
  const texture = new CubeTexture(faces.filter((face) => face !== null))
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  environments.set(isStudio, texture)
  return texture
}

// The manual look outlines the bricks; the others drop the outlines, and the photographic ones keep the same lines as pale
// catch-lights along the brick edges, where moulded plastic catches the light.
const styleEdges = (materials: ReadonlySet<LineBasicMaterial>, look: LookAppearance) => {
  for (const material of materials) {
    if (look.catchLightOpacity > 0) {
      material.color.set(0xffffff)
      material.transparent = true
      material.opacity = look.catchLightOpacity
      material.blending = AdditiveBlending
      material.depthWrite = false
    } else if (look.isEdgeVisible) {
      material.transparent = true
      material.opacity = PLASTIC_APPEARANCE.edgeOpacity
      material.color.lerp(new Color(0x000000), PLASTIC_APPEARANCE.edgeDarkening)
    } else {
      material.visible = false
    }
  }
}

const createPlasticMaterial = (
  source: MeshStandardMaterial,
  look: LookAppearance
): MeshPhysicalMaterial => {
  const isMetal = source.metalness > 0.5
  const material = new MeshPhysicalMaterial({
    color: source.color,
    roughness: isMetal ? source.roughness : look.roughness,
    metalness: source.metalness,
    clearcoat: isMetal ? 0 : look.clearcoat,
    clearcoatRoughness: look.clearcoatRoughness,
    envMap: getEnvironment(look.isEnvironmentStudio),
    envMapIntensity: look.environmentIntensity,
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
  createPlasticMaterial(new MeshStandardMaterial({ color, side: DoubleSide }), getActiveLook())

export const createPlasticMaterialFromTexture = (map: Texture): MeshPhysicalMaterial => {
  const material = createPlasticMaterial(
    new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide }),
    getActiveLook()
  )
  material.map = map
  material.alphaTest = DECAL_ALPHA_TEST
  return material
}

const isConditionalLineMaterial = (material: unknown): material is LineBasicMaterial =>
  material instanceof Object && Reflect.get(material, 'isConditionalLineMaterial') === true

// `bakedVolume` is the occlusion grid a worker has baked for the model, as a texture; left out, the model is baked here.
export const applyPlasticLook = (model: Object3D, bakedVolume?: OcclusionVolume | null) => {
  const look = getActiveLook()
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
  const volume: OcclusionVolume | null =
    bakedVolume !== undefined
      ? bakedVolume
      : getLookNeedsShader(look)
        ? bakeOcclusionVolume(model)
        : null
  for (const mesh of meshes) {
    const plastic = plasticBySource.get(mesh.material) ?? createPlasticMaterial(mesh.material, look)
    if (volume !== null && !plasticBySource.has(mesh.material)) {
      applyLookShader(plastic, look, volume)
    }
    plasticBySource.set(mesh.material, plastic)
    mesh.material = plastic
  }
  styleEdges(edgeMaterials, look)
}

// Key light from above and the front left, a cooler fill from the right, a sky and ground tint, and the studio in the plastic.
// The lights live in the car's frame (z up) and aim at its origin, so a car looks the same wherever it is.
export const createStudioLights = (): Group => {
  const look = getActiveLook()
  const lights = new Group()
  const key = new DirectionalLight(look.keyColor, look.keyIntensity)
  key.position.set(-40, -70, 100)
  const fill = new DirectionalLight(0xdbe8ff, look.fillIntensity)
  fill.position.set(90, 50, 30)
  const rim = new DirectionalLight(0xffffff, look.rimIntensity)
  rim.position.set(20, 90, 50)
  const hemisphere = new HemisphereLight(0xffffff, 0x8a8f99, look.hemisphereIntensity)
  hemisphere.position.set(0, 0, 100)
  hemisphere.up.set(0, 0, 1)
  lights.add(
    new AmbientLight(0xffffff, look.ambientIntensity),
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
