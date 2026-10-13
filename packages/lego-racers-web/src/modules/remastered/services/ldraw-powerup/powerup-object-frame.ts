import type { ModelScene, SceneMesh } from '@lego-games/lego-racers/scene'
import { STUD_WIDTH } from '@lego-games/ldraw/building'
import { Box3, Matrix4, Vector3 } from 'three'
import { LDRAW_TO_GAME, LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'

// The frames and scales of the effect files (`powerups/<MODEL>.ldr`, `particles/<KIND>.ldr`), in one place: the builder and the race
// both take them from here, so what the builder shows is what the race draws.
//
// Power-up objects. The drawing stands where the race puts the original's mesh as its file stores it, the model's scale applied (the
// frame `getEffectModelDrawing` draws in; the race then poses it with the bone the mesh's first vertex hangs on, as that bone turns
// the mesh). Of a mesh on several bones only that bone's vertices count; a mesh with no triangle on that bone (the turbo flames, a
// curse ring) is framed by all its vertices. The file's LDraw axes become the game's ((x, y, z) to (x, z, -y): -y up is z up, x stays
// x, the way a rocket flies). The builder shows the original in studs of the power-up brick (POWER_UP_STUD_UNITS, the stud of
// PUBRICKY's 1 x 3 brick in its mesh), the bottom centre of its bounds on the origin, and the file's parts in those studs times the
// file's scale (`0 !RACERS SCALE`, 1: a stud of the file is a stud of the power-up brick), its origin on the same origin. The race
// draws a file with a scale exactly so; a file without one is fitted: scaled uniformly until its largest extent is the original's and
// centred on the original's bounds (the builder opens it at that fitted scale, and Done writes it).
//
// Particles. A part of a particle's file is drawn at the size of a car's stud in the race (CAR_STUD_UNITS) times the file's scale
// (none: 1, real LEGO size), facing the camera as the original's quad does; the builder shows the file in car studs over the quad of
// the kind's first row at its size in the same studs (ldraw-particle-pieces.ts lays out how many pieces a quad gets).
export const POWER_UP_STUD_UNITS = 2.34
// A built car's mesh is in studs (LDRAW_TO_STUDS) and the race draws it unscaled: a car's stud is one unit of the race's world.
export const CAR_STUD_UNITS = 1
const VERTEX_SIZE = 3
const TRIANGLE_CORNERS = 3

// The bone the drawing follows: the one the mesh's first vertex hangs on (0 for a mesh without a skeleton).
const getPosedBone = (mesh: SceneMesh): number => mesh.drawBatches[0]?.transformIndices[0] ?? 0

// The triangles (three vertex indices each) whose corners all hang on the drawing's bone.
export const getPosedTriangles = (mesh: SceneMesh): readonly number[] => {
  const bone = getPosedBone(mesh)
  return mesh.drawBatches.flatMap((batch) => {
    const corners: number[] = []
    for (
      let corner = 0;
      corner + TRIANGLE_CORNERS <= batch.vertexIndices.length;
      corner += TRIANGLE_CORNERS
    ) {
      const isPosed = [0, 1, 2].every((offset) => batch.transformIndices[corner + offset] === bone)
      if (isPosed) corners.push(...batch.vertexIndices.subarray(corner, corner + TRIANGLE_CORNERS))
    }
    return corners
  })
}

// The mesh the race draws for the model (its first instance's first level).
export const getEffectMesh = (model: ModelScene): SceneMesh | null =>
  model.scene.meshes[model.scene.instances[0]?.levels[0]?.meshIndex ?? 0] ?? null

const getScaledBounds = (mesh: SceneMesh, scale: number, indices: Iterable<number>): Box3 => {
  const bounds = new Box3()
  const point = new Vector3()
  for (const index of indices) {
    point.fromArray(mesh.positions, index * VERTEX_SIZE).multiplyScalar(scale)
    bounds.expandByPoint(point)
  }
  return bounds
}

// The bounds of the original's mesh in the drawing's frame: the vertices on the drawing's bone, the model's scale applied (empty
// when no triangle is on it).
export const getOriginalModelBounds = (model: ModelScene): Box3 => {
  const mesh = getEffectMesh(model)
  return mesh === null
    ? new Box3()
    : getScaledBounds(mesh, model.meshScales[0] ?? 1, getPosedTriangles(mesh))
}

const SAMPLES_PER_CLIP = 8
const SAMPLE_STEP_MILLISECONDS = 125

// Every vertex of a skeletal mesh as its animation poses it, in the frame of the drawing's bone (the race poses the drawing with
// that bone's matrix), every 125 ms over the first second of every clip: the room the mesh takes while it plays. Null without a
// skeleton.
const getAnimatedBounds = (model: ModelScene, mesh: SceneMesh): Box3 | null => {
  const sampler = createSkeletonPoseSampler(model)
  if (sampler === null) return null
  const bone = getPosedBone(mesh)
  const bounds = new Box3()
  const point = new Vector3()
  const addPose = (matrices: readonly Matrix4[]) => {
    const toBone = (matrices[bone] ?? new Matrix4()).clone().invert()
    for (const batch of mesh.drawBatches) {
      batch.vertexIndices.forEach((vertex, corner) => {
        const vertexBone = matrices[batch.transformIndices[corner] ?? 0] ?? new Matrix4()
        point.fromArray(mesh.positions, vertex * VERTEX_SIZE).applyMatrix4(vertexBone)
        bounds.expandByPoint(point.applyMatrix4(toBone))
      })
    }
  }
  addPose(sampler.restMatrices)
  for (let clipIndex = 0; ; clipIndex += 1) {
    let state = sampler.createState(clipIndex)
    if (state === null) break
    for (let sample = 0; sample < SAMPLES_PER_CLIP; sample += 1) {
      addPose(sampler.getMatrices(state))
      state = sampler.advance(state, SAMPLE_STEP_MILLISECONDS)
    }
  }
  const scale = model.meshScales[0] ?? 1
  return bounds.isEmpty() ? null : bounds.applyMatrix4(new Matrix4().makeScale(scale, scale, scale))
}

// The bounds a file is framed by: the posed bounds; else (a mesh with no triangle on its posed bone: the turbo flames, a curse
// ring) every vertex as the animation poses it in the posed bone's frame; else every vertex as the file stores it.
export const getOriginalFrameBounds = (model: ModelScene): Box3 => {
  const posed = getOriginalModelBounds(model)
  const mesh = getEffectMesh(model)
  if (!posed.isEmpty() || mesh === null) return posed
  return (
    getAnimatedBounds(model, mesh) ??
    getScaledBounds(mesh, model.meshScales[0] ?? 1, Array(mesh.vertexCount).keys())
  )
}

const getLargestExtent = (bounds: Box3): number => {
  const size = bounds.getSize(new Vector3())
  return Math.max(size.x, size.y, size.z)
}

// Where the builder's origin is in the drawing's frame: the bottom centre of the original's bounds.
const getAnchor = (originalBounds: Box3): Vector3 =>
  originalBounds.isEmpty()
    ? new Vector3()
    : originalBounds.getCenter(new Vector3()).setZ(originalBounds.min.z)

const getPowerUpUnitsPerLDrawUnit = (scale: number): number =>
  (scale * POWER_UP_STUD_UNITS) / STUD_WIDTH

// The scale the fit gives a file (LDraw units and axes, `fileBounds` its bounds): its largest extent the original's; 1 when either
// has no extent.
export const getFittedPowerUpScale = (originalBounds: Box3, fileBounds: Box3): number => {
  const fileExtent = getLargestExtent(fileBounds.clone().applyMatrix4(LDRAW_TO_GAME))
  const originalExtent = getLargestExtent(originalBounds)
  return fileExtent > 0 && originalExtent > 0
    ? originalExtent / fileExtent / getPowerUpUnitsPerLDrawUnit(1)
    : 1
}

// The matrix that takes the file's points (LDraw units and axes, `fileBounds` their bounds) into the drawing's frame: with a scale,
// the builder's frame (its origin on the original's bottom centre, a stud the power-up brick's times the scale); without one
// (null), fitted to the original's largest extent and centred on its bounds.
export const getPowerUpObjectMatrix = (
  originalBounds: Box3,
  fileBounds: Box3,
  scale: number | null
): Matrix4 => {
  if (scale !== null) {
    const unitsPerLDrawUnit = getPowerUpUnitsPerLDrawUnit(scale)
    return new Matrix4()
      .makeTranslation(getAnchor(originalBounds))
      .multiply(new Matrix4().makeScale(unitsPerLDrawUnit, unitsPerLDrawUnit, unitsPerLDrawUnit))
      .multiply(LDRAW_TO_GAME)
  }
  const turned = fileBounds.clone().applyMatrix4(LDRAW_TO_GAME)
  const fitted = getPowerUpUnitsPerLDrawUnit(getFittedPowerUpScale(originalBounds, fileBounds))
  const fileCentre = turned.isEmpty() ? new Vector3() : turned.getCenter(new Vector3())
  const originalCentre = originalBounds.isEmpty()
    ? new Vector3()
    : originalBounds.getCenter(new Vector3())
  return new Matrix4()
    .makeTranslation(originalCentre)
    .multiply(new Matrix4().makeScale(fitted, fitted, fitted))
    .multiply(new Matrix4().makeTranslation(fileCentre.negate()))
    .multiply(LDRAW_TO_GAME)
}

// The matrix that shows the original's mesh (the drawing's frame) in the builder's (studs, the game's axes): a stud of the power-up
// brick is one, the bounds' bottom centre on the origin.
export const getPowerUpReferenceMatrix = (originalBounds: Box3): Matrix4 =>
  new Matrix4()
    .makeScale(1 / POWER_UP_STUD_UNITS, 1 / POWER_UP_STUD_UNITS, 1 / POWER_UP_STUD_UNITS)
    .multiply(new Matrix4().makeTranslation(getAnchor(originalBounds).negate()))

// The matrix that shows a file's parts in the builder (LDraw units and axes into its studs) at the file's scale.
export const getBuildFrameMatrix = (scale: number): Matrix4 =>
  LDRAW_TO_STUDS.clone().multiply(new Matrix4().makeScale(scale, scale, scale))

// The race's units per LDraw unit of a particle's part at the file's scale: a stud of the file is a car's stud times the scale.
export const getParticleUnitsPerLDrawUnit = (scale: number): number =>
  (scale * CAR_STUD_UNITS) / STUD_WIDTH

// The scale that fits a file (LDraw units and axes) to a sprite `spriteSize` across (race units): its largest extent the sprite's.
export const getFittedSpriteScale = (spriteSize: number, fileBounds: Box3): number => {
  const fileExtent = getLargestExtent(fileBounds)
  return fileExtent > 0 && spriteSize > 0
    ? spriteSize / fileExtent / getParticleUnitsPerLDrawUnit(1)
    : 1
}

// A size of the race's world (a particle's quad) in the builder's studs.
export const getParticleSizeInStuds = (size: number): number => size / CAR_STUD_UNITS
