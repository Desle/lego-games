import { getLitVertexColor } from '@lego-games/lego-racers/cinema'
import type { LightChannels } from '@lego-games/lego-racers/cinema'
import { Mesh, Matrix3, Vector3 } from 'three'
import type { BufferAttribute, BufferGeometry, Object3D } from 'three'
import type { LitMaterial, SceneLights } from './vertex-lighting.types.ts'

export const LIT_MATERIAL_KEY = 'litMaterial'
const UNLIT: SceneLights = Object.freeze({ ambient: [255, 255, 255], directional: [] })
const COLOR_SIZE = 4

const getLitMaterial = (geometry: BufferGeometry): LitMaterial | null => {
  const material: unknown = geometry.userData[LIT_MATERIAL_KEY]
  return material === undefined ? null : (material as LitMaterial)
}

// The device lights a model with normals and no vertex colours on the CPU (GolDP.dll 0x10011ed0): each vertex colour is
// recomputed from the normal, rotated into the world, and the lights (null: the race's ambient of 255 and no light).
export const applyVertexLighting = (root: Object3D, lights: SceneLights | null): void => {
  const scene = lights ?? UNLIT
  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.geometry as BufferGeometry
    const material = getLitMaterial(geometry)
    const normals = geometry.getAttribute('normal') as BufferAttribute | undefined
    if (material === null || normals === undefined) return
    const colors = geometry.getAttribute('color') as BufferAttribute
    const normalMatrix = new Matrix3().getNormalMatrix(object.matrixWorld)
    const normal = new Vector3()
    for (let corner = 0; corner < normals.count; corner += 1) {
      normal.fromBufferAttribute(normals, corner).applyMatrix3(normalMatrix).normalize()
      const [red, green, blue] = getLitVertexColor({
        ambient: scene.ambient,
        materialAmbient: material.ambient,
        materialDiffuse: material.diffuse,
        lights: scene.directional,
        normal: [normal.x, normal.y, normal.z] satisfies LightChannels,
      })
      colors.array[corner * COLOR_SIZE] = red
      colors.array[corner * COLOR_SIZE + 1] = green
      colors.array[corner * COLOR_SIZE + 2] = blue
    }
    colors.needsUpdate = true
  })
}
