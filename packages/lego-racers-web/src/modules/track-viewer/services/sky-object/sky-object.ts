import type { Scene, SceneMesh } from '@lego-games/lego-racers/scene'
import {
  advanceSky,
  createSkyDome,
  createSkyState,
  getSkyPlacement,
  getSkyRingColors,
  getSkyVertexColors,
} from '@lego-games/lego-racers/sky'
import type { Sky, SkyDome, SkyPoint, SkyRingColors } from '@lego-games/lego-racers/sky'
import type { BufferAttribute, DataTexture } from 'three'
import { Mesh } from 'three'
import { createBatchGeometry } from '../scene-object/batch-geometry.ts'
import { createSceneMaterial } from '../scene-object/scene-material.ts'
import type { SkyObject } from './sky-object.types.ts'

// LEGORacers.exe 0x0041cb61..0x0041cb87: the dome's only material is the one named "skymat".
const SKY_MATERIAL_NAME = 'skymat'
const COLOR_COMPONENTS = 4

// A later library's name shadows an earlier one's.
const getSkyMaterialIndex = (scene: Scene): number =>
  scene.materials.findLastIndex((material) => material.name === SKY_MATERIAL_NAME)

// The dome as a scene mesh, so it takes the same material state and face culling as every model.
const getDomeMesh = (dome: SkyDome, ringColors: SkyRingColors, materialIndex: number): SceneMesh =>
  Object.freeze({
    name: 'sky',
    path: '',
    vertexCount: dome.vertexCount,
    positions: dome.positions,
    textureCoordinates: new Float32Array(dome.vertexCount * 2),
    colors: getSkyVertexColors(dome, ringColors),
    normals: null,
    materialIndices: [materialIndex],
    drawBatches: [
      Object.freeze({
        materialSlot: 0,
        firstCommand: 0,
        vertexIndices: Uint32Array.from(dome.triangleCorners),
        transformIndices: new Uint8Array(dome.triangleCorners.length),
      }),
    ],
  })

// The sky of a race (LEGORacers.exe 0x0041c550, 0x0041ccb0, 0x0041d040): the dome, drawn first without the
// depth test, centred on the camera and recoloured by the running keyframes. Null when the scene has no
// "skymat" material.
export const createSkyObject = (sky: Sky, scene: Scene): SkyObject | null => {
  const materialIndex = getSkyMaterialIndex(scene)
  const sceneMaterial = scene.materials[materialIndex]
  if (sceneMaterial === undefined) return null
  const dome = createSkyDome()
  let state = createSkyState(sky)
  let ringColors = getSkyRingColors(state)
  const domeMesh = getDomeMesh(dome, ringColors, materialIndex)
  const textureCache = new Map<string, DataTexture>()
  const material = createSceneMaterial(sceneMaterial, scene.textures, textureCache)
  material.depthTest = false
  material.depthWrite = false
  const [batch] = domeMesh.drawBatches
  if (batch === undefined) return null
  const geometry = createBatchGeometry(domeMesh, batch, sceneMaterial.renderState)
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  const getIsRingColorChanged = (next: SkyRingColors) =>
    next.some((triple, ring) =>
      triple.some((value, channel) => value !== ringColors[ring]?.[channel])
    )
  const setCornerColors = () => {
    const vertexColors = getSkyVertexColors(dome, ringColors)
    const attribute = geometry.getAttribute('color') as BufferAttribute
    for (const [corner, vertex] of dome.triangleCorners.entries()) {
      attribute.array.set(
        vertexColors.subarray(vertex * COLOR_COMPONENTS, (vertex + 1) * COLOR_COMPONENTS),
        corner * COLOR_COMPONENTS
      )
    }
    attribute.needsUpdate = true
  }
  return Object.freeze({
    mesh,
    animate: (deltaMilliseconds: number) => {
      state = advanceSky(state, deltaMilliseconds)
      const next = getSkyRingColors(state)
      if (!getIsRingColorChanged(next)) return
      ringColors = next
      setCornerColors()
    },
    place: (cameraPosition: SkyPoint) => {
      const placement = getSkyPlacement(cameraPosition, sky.float ?? 0)
      mesh.position.set(placement.dome.x, placement.dome.y, placement.dome.z)
      return placement
    },
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  })
}
