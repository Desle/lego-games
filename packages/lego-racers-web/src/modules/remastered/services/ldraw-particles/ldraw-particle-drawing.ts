import { Matrix4, Vector3 } from 'three'
import { createPartParticles } from '@lego-games/ldraw/particles'
import type {
  ParticleDrawing,
  ParticleDrawingRequest,
  ParticleView,
  WorldVector,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { LDRAW_PARTICLE_MATERIALS, LDRAW_PARTICLE_PARTS } from './ldraw-particle-mappings.ts'
import type { LDrawParticleKind } from './ldraw-particle-mappings.types.ts'

// The round parts are a stud (20 LDraw units) across: that width spans the original's quad.
const PART_WIDTH = 20
const BYTE_MAXIMUM = 255
// Ten emitters of the common pool and fourteen of the track's, sixteen particles each.
const MAXIMUM_PARTICLES = 24 * 16

const getLength = (vector: WorldVector): number => Math.hypot(vector.x, vector.y, vector.z)

// The part faces the camera as the quad does, its studs toward the viewer: LDraw x along the quad's right side, LDraw z up the
// quad (against its down side), LDraw y (down, away from the studs) away from the camera (right x down). The part is a stud across
// the quad's width and as deep as it is wide.
export const setParticleMatrix = (matrix: Matrix4, view: ParticleView): Matrix4 => {
  const right = new Vector3(view.right.x, view.right.y, view.right.z)
  const down = new Vector3(view.down.x, view.down.y, view.down.z)
  const width = getLength(view.right)
  const height = getLength(view.down)
  const away = new Vector3().crossVectors(right, down).normalize()
  const depthScale = (width + height) / 2 / PART_WIDTH
  right.normalize().multiplyScalar(width / PART_WIDTH)
  down.normalize().multiplyScalar(-height / PART_WIDTH)
  away.multiplyScalar(depthScale)
  return matrix.set(
    right.x,
    away.x,
    down.x,
    view.centre.x,
    right.y,
    away.y,
    down.y,
    view.centre.y,
    right.z,
    away.z,
    down.z,
    view.centre.z,
    0,
    0,
    0,
    1
  )
}

// The original fades a particle through its material rows' opacity: the part is solid at the material's solid alpha.
export const getParticleOpacity = (view: ParticleView): number => {
  const solidAlpha = LDRAW_PARTICLE_MATERIALS[view.materialName]?.solidAlpha ?? BYTE_MAXIMUM
  return Math.min(1, view.color[3] / solidAlpha)
}

const createKindDrawing = (kind: LDrawParticleKind, onDisposed: () => void): ParticleDrawing => {
  const part = LDRAW_PARTICLE_PARTS[kind]
  const particles = createPartParticles({ ...part, maxCount: MAXIMUM_PARTICLES })
  particles.shown.catch((error: unknown) =>
    console.error(`The LDraw library could not build the ${kind} particle`, error)
  )
  const matrix = new Matrix4()
  return {
    object: particles.object,
    setParticles: (views) =>
      particles.setParticles(views.length, (index, slot) => {
        const view = views[index]
        if (view === undefined) return
        slot.setMatrix(setParticleMatrix(matrix, view))
        slot.setOpacity(getParticleOpacity(view))
      }),
    dispose: () => {
      particles.dispose()
      onDisposed()
    },
  }
}

const liveDrawings = new Map<LDrawParticleKind, ParticleDrawing>()

// The kind's drawing for a particle material, shared by every material of the kind while the race that asked for it lives; null
// for a material the layer leaves to the original.
export const createLDrawParticleDrawing = (
  request: ParticleDrawingRequest
): ParticleDrawing | null => {
  const material = LDRAW_PARTICLE_MATERIALS[request.materialName]
  if (material === undefined) return null
  const existing = liveDrawings.get(material.kind)
  if (existing !== undefined) return existing
  const drawing = createKindDrawing(material.kind, () => liveDrawings.delete(material.kind))
  liveDrawings.set(material.kind, drawing)
  return drawing
}
