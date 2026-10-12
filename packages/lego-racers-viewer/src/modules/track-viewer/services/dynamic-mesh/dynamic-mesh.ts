import type { Scene, SceneMaterial } from '@lego-games/lego-racers/scene'
import { BufferAttribute, BufferGeometry, LessEqualDepth, type Material } from 'three'
import { createSceneMaterial } from '../scene-object/scene-material.ts'

const POSITION_SIZE = 3
const COORDINATE_SIZE = 2
const COLOR_SIZE = 4

// A geometry for `cornerCount` corners that is filled again every frame: positions, picture coordinates and colours.
export const createDynamicGeometry = (cornerCount: number): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(cornerCount * POSITION_SIZE), POSITION_SIZE)
  )
  geometry.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array(cornerCount * COORDINATE_SIZE), COORDINATE_SIZE)
  )
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Uint8Array(cornerCount * COLOR_SIZE), COLOR_SIZE, true)
  )
  geometry.setDrawRange(0, 0)
  return geometry
}

// The material of a decal: drawn under an alpha of its own (the device's override), so the colour key stays off, and
// with the depth written.
export const createDecalMaterial = (scene: Scene, material: SceneMaterial): Material => {
  const three = createSceneMaterial(
    { ...material, renderState: { ...material.renderState, isAlphaTestEnabled: false } },
    scene.textures,
    new Map()
  )
  three.depthWrite = true
  three.depthFunc = LessEqualDepth
  return three
}
