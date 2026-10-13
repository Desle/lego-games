import type { Box3 } from 'three'
import { Matrix4, Vector3 } from 'three'
import { createPartParticles, getParticlePartText } from '@lego-games/ldraw/particles'
import type {
  ParticleDrawing,
  ParticleDrawingRequest,
  ParticleView,
  WorldVector,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'
import { getParticleUnitsPerLDrawUnit } from '../ldraw-powerup/powerup-object-frame.ts'
import { findPowerUpSpriteName, POWER_UP_SPRITE_NAMES } from '../ldraw-powerup/powerup-sprites.ts'
import { getModelFileScale } from '../ldraw-scale-meta/ldraw-scale-meta.ts'
import { LDRAW_PARTICLE_MATERIALS, LDRAW_PARTICLE_PARTS } from './ldraw-particle-mappings.ts'
import { LDrawParticleKind } from './ldraw-particle-mappings.types.ts'
import { getParticlePieceScale, PARTICLE_NEAR_FADE_DISTANCE } from './ldraw-particle-size.ts'
import type { ParticleKindModel } from './ldraw-particle-drawing.types.ts'

// Ten emitters of the common pool and fourteen of the track's, sixteen particles each: one piece per original quad.
const MAXIMUM_PARTICLES = 24 * 16
const DEFAULT_SCALE = 1

const getLength = (vector: WorldVector): number => Math.hypot(vector.x, vector.y, vector.z)

// A piece faces the camera as the quad does, its studs toward the viewer: LDraw x along the quad's right side, LDraw z up the quad
// (against its down side), LDraw y (down, away from the studs) away from the camera (right x down); it is `unitsPerLDrawUnit` times
// `pieceScale` in every direction, at the quad's centre.
export const setParticlePieceMatrix = (
  matrix: Matrix4,
  view: ParticleView,
  pieceScale: number,
  unitsPerLDrawUnit: number
): Matrix4 => {
  const right = new Vector3(view.right.x, view.right.y, view.right.z).normalize()
  const down = new Vector3(view.down.x, view.down.y, view.down.z).normalize()
  const away = new Vector3().crossVectors(right, down).normalize()
  const scale = unitsPerLDrawUnit * pieceScale
  right.multiplyScalar(scale)
  down.multiplyScalar(-scale)
  away.multiplyScalar(scale)
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

// The original fades a particle through its material rows' opacity: the part is solid at the material's solid alpha. A sprite
// (no particle material) is solid.
export const getParticleOpacity = (view: ParticleView): number => {
  const solidAlpha = LDRAW_PARTICLE_MATERIALS[view.materialName]?.solidAlpha
  return solidAlpha === undefined ? 1 : Math.min(1, view.color[3] / solidAlpha)
}

// The width of a piece across the quad (its LDraw x or z extent, whichever is larger) in the race's units.
export const getPieceWidth = (bounds: Box3, unitsPerLDrawUnit: number): number => {
  const size = bounds.getSize(new Vector3())
  return Math.max(size.x, size.z) * unitsPerLDrawUnit
}

// The files read for the race, by kind of particle or power-up sprite name.
const loadedFiles = new Map<string, ParticleKindModel>()

// The model a kind is drawn with: its file in the models folder (`particles/<KIND>.ldr`, at its scale line's factor, 1 without),
// else the kind's part at real size.
export const getParticleKindModel = (kind: LDrawParticleKind): ParticleKindModel => {
  const loaded = loadedFiles.get(kind)
  if (loaded !== undefined) return loaded
  const part = LDRAW_PARTICLE_PARTS[kind]
  return Object.freeze({
    modelText: getParticlePartText(part.partName, part.colorCode),
    scale: DEFAULT_SCALE,
    file: null,
    isSizeCapped: true,
  })
}

// A power-up sprite's file (`powerups/<NAME>.ldr`), null when the folder has none and the original's sprite is drawn.
export const getPowerUpSpriteModel = (name: string): ParticleKindModel | null =>
  loadedFiles.get(name) ?? null

const loadFile = async (
  key: string,
  file: string | undefined,
  isSizeCapped: boolean
): Promise<void> => {
  const text = file === undefined ? null : await loadLDrawModelText(file)
  if (file === undefined || text === null) return
  loadedFiles.set(
    key,
    Object.freeze({
      modelText: text,
      scale: getModelFileScale(text) ?? DEFAULT_SCALE,
      file,
      isSizeCapped,
    })
  )
}

// The file of each kind and power-up sprite the models folder has, read before a race asks for its drawings (they are made when the
// race loads).
export const prepareParticleFiles = async (index: LDrawModelIndex): Promise<void> => {
  loadedFiles.clear()
  await Promise.all([
    ...Object.values(LDrawParticleKind).map((kind) =>
      loadFile(kind, index.particles[kind.toUpperCase()], true)
    ),
    ...POWER_UP_SPRITE_NAMES.map((name) => loadFile(name, index.powerUps[name], false)),
  ])
}

// One piece per original quad: a particle's capped to its own size (ldraw-particle-size.ts), a power-up sprite's file at its scale.
const createModelDrawing = (
  label: string,
  model: ParticleKindModel,
  onDisposed: () => void
): ParticleDrawing => {
  const particles = createPartParticles({
    modelText: model.modelText,
    maxCount: MAXIMUM_PARTICLES,
    nearFadeDistance: PARTICLE_NEAR_FADE_DISTANCE,
  })
  particles.shown.catch((error: unknown) =>
    console.error(`The LDraw library could not build the ${label} particle`, error)
  )
  const unitsPerLDrawUnit = getParticleUnitsPerLDrawUnit(model.scale)
  const matrix = new Matrix4()
  return {
    object: particles.object,
    setParticles: (views) => {
      const bounds = particles.getModelBounds()
      const pieceWidth = bounds === null ? 0 : getPieceWidth(bounds, unitsPerLDrawUnit)
      particles.setParticles(views.length, (index, slot) => {
        const view = views[index]
        if (view === undefined) return
        const pieceScale = model.isSizeCapped
          ? getParticlePieceScale(getLength(view.right), getLength(view.down), pieceWidth)
          : 1
        slot.setMatrix(setParticlePieceMatrix(matrix, view, pieceScale, unitsPerLDrawUnit))
        slot.setOpacity(getParticleOpacity(view))
      })
    },
    dispose: () => {
      particles.dispose()
      onDisposed()
    },
  }
}

const liveDrawings = new Map<string, ParticleDrawing>()

// What draws a material's quads: a power-up sprite's file, else the kind of particle's model; null for a material the layer leaves
// to the original.
const getMaterialModel = (materialName: string): readonly [string, ParticleKindModel] | null => {
  const spriteName = findPowerUpSpriteName(materialName)
  const sprite = spriteName === undefined ? null : getPowerUpSpriteModel(spriteName)
  if (spriteName !== undefined && sprite !== null) return [spriteName, sprite]
  const material = LDRAW_PARTICLE_MATERIALS[materialName]
  return material === undefined ? null : [material.kind, getParticleKindModel(material.kind)]
}

// Whether the layer draws a material's quads (a mapped particle material, or a power-up sprite's whose file the folder has).
export const getIsParticleMaterialDrawn = (materialName: string): boolean =>
  getMaterialModel(materialName) !== null

// The drawing for a particle material (or a power-up sprite's), shared by every material of the kind while the race that asked
// for it lives; null for a material the layer leaves to the original.
export const createLDrawParticleDrawing = (
  request: ParticleDrawingRequest
): ParticleDrawing | null => {
  const found = getMaterialModel(request.materialName)
  if (found === null) return null
  const [key, model] = found
  const existing = liveDrawings.get(key)
  if (existing !== undefined) return existing
  const drawing = createModelDrawing(key, model, () => liveDrawings.delete(key))
  liveDrawings.set(key, drawing)
  return drawing
}
