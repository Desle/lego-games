import {
  getBillboardAxes,
  getEmitterQuads,
  getSpriteQuad,
  QUAD_TRIANGLE_CORNERS,
} from '@lego-games/lego-racers/emitter'
import type { EmitterPool, EmitterQuad } from '@lego-games/lego-racers/emitter'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '@lego-games/lego-racers/simulation-math'
import type { SpriteView } from '@lego-games/lego-racers/race-presentation'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { BufferAttribute } from 'three'
import { Group, Mesh, type Material } from 'three'
import { createDynamicGeometry } from '../dynamic-mesh/dynamic-mesh.ts'
import { createSceneMaterial } from '../scene-object/scene-material.ts'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { MaterialBatch, RaceParticles } from './race-particles.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// Ten emitters of the common pool and fourteen of the track's, sixteen particles each, two triangles a particle.
const MAXIMUM_CORNERS = 24 * 16 * QUAD_TRIANGLE_CORNERS.length * 3
const BYTE_MAXIMUM = 255

const createBatch = (scenes: readonly Scene[], materialName: string): MaterialBatch | null => {
  const scene = scenes.find((candidate) =>
    candidate.materials.some((material) => material.name === materialName)
  )
  const sceneMaterial = scene?.materials.findLast((candidate) => candidate.name === materialName)
  if (scene === undefined || sceneMaterial === undefined) return null
  const geometry = createDynamicGeometry(MAXIMUM_CORNERS)
  const mesh = new Mesh(geometry, createSceneMaterial(sceneMaterial, scene.textures, new Map()))
  mesh.frustumCulled = false
  mesh.visible = false
  const [red, green, blue, alpha] = sceneMaterial.diffuseColor
  // A material with an opacity of its own draws with it in the vertex alpha.
  return { mesh, color: [red, green, blue, sceneMaterial.renderState.diffuseAlpha ?? alpha] }
}

// The live particles of the race's emitter pools as the billboard quads of the engine (0x00412a50): each quad is
// drawn with the material of its particle, in the colour of that material.
export const createRaceParticles = (scenes: readonly Scene[]): RaceParticles => {
  const group = new Group()
  const batches = new Map<string, MaterialBatch | null>()
  const getBatch = (materialName: string): MaterialBatch | null => {
    if (!batches.has(materialName)) {
      const batch = createBatch(scenes, materialName)
      batches.set(materialName, batch)
      if (batch !== null) group.add(batch.mesh)
    }
    return batches.get(materialName) ?? null
  }
  const update = (
    pools: readonly (EmitterPool | null)[],
    cameraView: CameraView,
    sprites: readonly SpriteView[] = []
  ) => {
    const axes = getBillboardAxes(arithmetic, cameraView.forward, cameraView.up)
    const quads: EmitterQuad[] = [
      ...pools.flatMap((pool) =>
        (pool?.instances ?? []).flatMap((instance) =>
          getEmitterQuads(arithmetic, instance.system, pool?.animation ?? null, {
            position: cameraView.position,
            axes,
          })
        )
      ),
      ...sprites.map((sprite) => getSpriteQuad(arithmetic, axes, sprite)),
    ]
    const counts = new Map<string, number>()
    for (const quad of quads) {
      const batch = getBatch(quad.materialName)
      if (batch === null) continue
      const count = counts.get(quad.materialName) ?? 0
      const positions = batch.mesh.geometry.getAttribute('position') as BufferAttribute
      const coordinates = batch.mesh.geometry.getAttribute('uv') as BufferAttribute
      const colors = batch.mesh.geometry.getAttribute('color') as BufferAttribute
      let corner = count
      for (const triangle of QUAD_TRIANGLE_CORNERS) {
        for (const index of triangle) {
          const source = quad.corners[index]
          if (source === undefined || corner >= MAXIMUM_CORNERS) continue
          positions.setXYZ(corner, source.x, source.y, source.z)
          coordinates.setXY(corner, source.u, source.v)
          colors.setXYZW(
            corner,
            batch.color[0] / BYTE_MAXIMUM,
            batch.color[1] / BYTE_MAXIMUM,
            batch.color[2] / BYTE_MAXIMUM,
            batch.color[3] / BYTE_MAXIMUM
          )
          corner += 1
        }
      }
      counts.set(quad.materialName, corner)
    }
    for (const [name, batch] of batches) {
      if (batch === null) continue
      const count = counts.get(name) ?? 0
      batch.mesh.geometry.setDrawRange(0, count)
      for (const attribute of ['position', 'uv', 'color']) {
        ;(batch.mesh.geometry.getAttribute(attribute) as BufferAttribute).needsUpdate = true
      }

      batch.mesh.visible = count > 0
    }
  }
  return Object.freeze({
    group,
    update,
    dispose: () => {
      for (const batch of batches.values()) {
        if (batch === null) continue
        batch.mesh.geometry.dispose()
        ;(batch.mesh.material as Material).dispose()
      }
    },
  })
}
