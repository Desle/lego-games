import {
  getBillboardAxes,
  getEmitterQuads,
  getSpriteQuad,
  QUAD_TRIANGLE_CORNERS,
} from '@lego-games/lego-racers/emitter'
import type { EmitterPool, EmitterQuad } from '@lego-games/lego-racers/emitter'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '@lego-games/lego-racers/simulation-math'
import { getRibbonCorners } from '@lego-games/lego-racers/ribbon'
import type { RibbonView } from '@lego-games/lego-racers/ribbon'
import type { TrailDrawing } from '@lego-games/lego-racers/projectile-trail'
import type { SpriteView } from '@lego-games/lego-racers/race-presentation'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { BufferAttribute } from 'three'
import { Group, Mesh, type Material } from 'three'
import { createDynamicGeometry } from '../dynamic-mesh/dynamic-mesh.ts'
import { createSceneMaterial } from '../scene-object/scene-material.ts'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type {
  BatchCorner,
  MaterialBatch,
  ParticleQuad,
  RaceParticles,
} from './race-particles.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// Ten emitters of the common pool and fourteen of the track's, sixteen particles each, two triangles a particle.
const MAXIMUM_CORNERS = 24 * 16 * QUAD_TRIANGLE_CORNERS.length * 3
const BYTE_MAXIMUM = 255
const WHITE_VERTEX_COLOR: readonly [number, number, number, number] = Object.freeze([
  BYTE_MAXIMUM,
  BYTE_MAXIMUM,
  BYTE_MAXIMUM,
  BYTE_MAXIMUM,
])

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
  return {
    mesh,
    color: [red, green, blue, sceneMaterial.renderState.diffuseAlpha ?? alpha],
    isDiffuseWhite: sceneMaterial.renderState.isDiffuseWhite,
  }
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
    sprites: readonly SpriteView[] = [],
    ribbons: readonly RibbonView[] = [],
    worldSpriteQuads: readonly EmitterQuad[] = [],
    trails: readonly TrailDrawing[] = []
  ) => {
    const axes = getBillboardAxes(arithmetic, cameraView.forward, cameraView.up)
    // A world sprite draws with the engine's white vertex array (0x1005ca4c), whatever its material's colour, and its
    // texture keeps the order of the file's rows (its texture lacks flag 4, see scene-material.ts).
    const quads: ParticleQuad[] = [
      ...worldSpriteQuads.map((quad) => ({ quad, isWorldSprite: true })),
      ...[
        ...pools.flatMap((pool) =>
          (pool?.instances ?? []).flatMap((instance) =>
            getEmitterQuads(arithmetic, instance.system, pool?.animation ?? null, {
              position: cameraView.position,
              axes,
            })
          )
        ),
        ...sprites.map((sprite) => getSpriteQuad(arithmetic, axes, sprite)),
      ].map((quad) => ({ quad, isWorldSprite: false })),
    ]
    const counts = new Map<string, number>()
    const addCorner = (
      batch: MaterialBatch,
      corner: number,
      source: BatchCorner,
      color: readonly [number, number, number, number]
    ) => {
      const positions = batch.mesh.geometry.getAttribute('position') as BufferAttribute
      const coordinates = batch.mesh.geometry.getAttribute('uv') as BufferAttribute
      const colors = batch.mesh.geometry.getAttribute('color') as BufferAttribute
      positions.setXYZ(corner, source.x, source.y, source.z)
      coordinates.setXY(corner, source.u, source.v)
      colors.setXYZW(
        corner,
        color[0] / BYTE_MAXIMUM,
        color[1] / BYTE_MAXIMUM,
        color[2] / BYTE_MAXIMUM,
        color[3] / BYTE_MAXIMUM
      )
    }
    for (const { quad, isWorldSprite } of quads) {
      const batch = getBatch(quad.materialName)
      if (batch === null) continue
      let corner = counts.get(quad.materialName) ?? 0
      for (const triangle of QUAD_TRIANGLE_CORNERS) {
        for (const index of triangle) {
          const source = quad.corners[index]
          if (source === undefined || corner >= MAXIMUM_CORNERS) continue
          addCorner(batch, corner, source, isWorldSprite ? WHITE_VERTEX_COLOR : batch.color)
          corner += 1
        }
      }
      counts.set(quad.materialName, corner)
    }
    for (const ribbon of ribbons) {
      const batch = getBatch(ribbon.materialName)
      if (batch === null) continue
      let corner = counts.get(ribbon.materialName) ?? 0
      const corners = getRibbonCorners(
        arithmetic,
        ribbon.skin,
        ribbon.isFacingCamera ? cameraView.forward : null
      )
      for (const source of corners) {
        if (corner >= MAXIMUM_CORNERS) continue
        // A texture-only material (the tether) takes no colour from its vertices.
        addCorner(
          batch,
          corner,
          { ...source.position, u: source.u, v: source.v },
          batch.isDiffuseWhite ? WHITE_VERTEX_COLOR : source.color
        )
        corner += 1
      }
      counts.set(ribbon.materialName, corner)
    }
    for (const { materialName, mesh } of trails) {
      const batch = getBatch(materialName)
      if (batch === null) continue
      let corner = counts.get(materialName) ?? 0
      for (const triangle of mesh.triangles) {
        for (const index of [triangle.first, triangle.second, triangle.third]) {
          const vertex = mesh.vertices[index]
          if (vertex === undefined || corner >= MAXIMUM_CORNERS) continue
          // The mesh sits at its origin in the world; the vertices carry the material's own colour bytes.
          addCorner(
            batch,
            corner,
            {
              x: Math.fround(vertex.position.x + mesh.origin.x),
              y: Math.fround(vertex.position.y + mesh.origin.y),
              z: Math.fround(vertex.position.z + mesh.origin.z),
              u: vertex.u,
              v: vertex.v,
            },
            [vertex.color.red, vertex.color.green, vertex.color.blue, vertex.color.alpha]
          )
          corner += 1
        }
      }
      counts.set(materialName, corner)
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
