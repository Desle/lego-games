import type { EmitterQuad } from '@lego-games/lego-racers/emitter'
import type { Scene } from '@lego-games/lego-racers/scene'
import { getParticleDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type {
  ParticleDrawing,
  ParticleView,
  WorldVector,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'

// The drawings a layer has for the particles of the materials of the scenes, asked for once when the race's particles are made, so
// they are built before the race runs. Without a layer there are none and every particle is the original's quad.
export const getMaterialParticleDrawings = (
  scenes: readonly Scene[]
): ReadonlyMap<string, ParticleDrawing> => {
  const names = new Set(scenes.flatMap((scene) => scene.materials.map((material) => material.name)))
  const drawings = new Map<string, ParticleDrawing>()
  for (const materialName of names) {
    const drawing = getParticleDrawing({ materialName })
    if (drawing !== null) drawings.set(materialName, drawing)
  }
  return drawings
}

const getDifference = (to: WorldVector, from: WorldVector): WorldVector =>
  Object.freeze({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z })

// A particle's quad (corners: centre minus half of each side, then along right, along down, back) as its centre and sides.
export const getParticleView = (
  quad: EmitterQuad,
  color: readonly [number, number, number, number]
): ParticleView => {
  const [first, second, third] = quad.corners
  return Object.freeze({
    materialName: quad.materialName,
    centre: Object.freeze({
      x: (first.x + third.x) / 2,
      y: (first.y + third.y) / 2,
      z: (first.z + third.z) / 2,
    }),
    right: getDifference(second, first),
    down: getDifference(third, second),
    color,
  })
}
