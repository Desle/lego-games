import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import type { Material, Texture } from 'three'
import { getTextureFromBitmap } from '../ldraw-car/game-brick-meshes.ts'
import { createPlasticMaterialFromTexture } from '../ldraw-car/ldraw-plastic.ts'
import type { BodyDecal } from './opponent-car.types.ts'

const DECAL_ALPHA_TEST = 0.5
// Pulls the printed faces in front of the bricks standing at the same place.
const DECAL_POLYGON_OFFSET = -4

const createDecalGeometry = (decal: BodyDecal): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(decal.positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(decal.textureCoordinates, 2))
  geometry.computeVertexNormals()
  return geometry
}

const createBasicDecalMaterial = (map: Texture): MeshBasicMaterial =>
  new MeshBasicMaterial({ map, side: DoubleSide, alphaTest: DECAL_ALPHA_TEST })

const createDecalMeshes = (
  decals: readonly BodyDecal[],
  createMaterial: (map: Texture) => Material
): Group => {
  const group = new Group()
  for (const decal of decals) {
    const material = createMaterial(getTextureFromBitmap(decal.bitmap))
    material.polygonOffset = true
    material.polygonOffsetFactor = DECAL_POLYGON_OFFSET
    material.polygonOffsetUnits = DECAL_POLYGON_OFFSET
    group.add(new Mesh(createDecalGeometry(decal), material))
  }
  return group
}

// The printed faces of a champion's body as the game draws them (a picture, its colour key cut out).
export const createBodyDecalMeshes = (decals: readonly BodyDecal[]): Group =>
  createDecalMeshes(decals, createBasicDecalMaterial)

// The printed faces in the library's plastic look, to stand on the LDraw bricks.
export const createPlasticBodyDecalMeshes = (decals: readonly BodyDecal[]): Group =>
  createDecalMeshes(decals, createPlasticMaterialFromTexture)
