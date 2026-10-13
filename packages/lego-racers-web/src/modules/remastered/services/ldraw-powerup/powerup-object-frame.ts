import type { ModelScene, SceneMesh } from '@lego-games/lego-racers/scene'
import { Box3, Matrix4, Vector3 } from 'three'
import { LDRAW_TO_GAME } from '../ldraw-car/ldraw-car-document.ts'

// The frame of a power-up object's LDraw file (`powerups/<MODEL>.ldr`), in one place.
//
// The drawing stands where the race puts the original's mesh as its file stores it, the model's scale applied (the frame
// `getEffectModelDrawing` draws in; the race then poses it with the bone the mesh's first vertex hangs on, as that bone turns the
// mesh). Of a mesh on several bones only that bone's vertices count. The file's LDraw axes become the game's ((x, y, z) to
// (x, z, -y): -y up is z up, x stays x, the way a rocket flies), then the file is scaled uniformly until its largest extent is the
// original's and centred on the original's bounds. So a file may be built at any size: the original's bounds give the scale, as
// the pickup bricks' were fitted to their meshes. The builder shows the original in studs of the power-up brick
// (POWER_UP_STUD_UNITS, the stud of PUBRICKY's 1 x 3 brick in its mesh), standing on the ground at the origin, so a file built on
// it keeps its proportions in the race.
export const POWER_UP_STUD_UNITS = 2.34
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

// The bounds of the original's mesh in the drawing's frame: the vertices on the drawing's bone, the model's scale applied.
export const getOriginalModelBounds = (model: ModelScene): Box3 => {
  const bounds = new Box3()
  const mesh = getEffectMesh(model)
  if (mesh === null) return bounds
  const scale = model.meshScales[0] ?? 1
  const point = new Vector3()
  for (const index of getPosedTriangles(mesh)) {
    point.fromArray(mesh.positions, index * VERTEX_SIZE).multiplyScalar(scale)
    bounds.expandByPoint(point)
  }
  return bounds
}

const getLargestExtent = (bounds: Box3): number => {
  const size = bounds.getSize(new Vector3())
  return Math.max(size.x, size.y, size.z)
}

// The matrix that takes the file's points (LDraw units and axes, `fileBounds` their bounds) into the drawing's frame: the game's
// axes, the original's largest extent and centre. A file or an original without extent is only turned and moved.
export const getPowerUpObjectMatrix = (originalBounds: Box3, fileBounds: Box3): Matrix4 => {
  const turned = fileBounds.clone().applyMatrix4(LDRAW_TO_GAME)
  const fileExtent = getLargestExtent(turned)
  const originalExtent = getLargestExtent(originalBounds)
  const scale = fileExtent > 0 && originalExtent > 0 ? originalExtent / fileExtent : 1
  const fileCentre = turned.isEmpty() ? new Vector3() : turned.getCenter(new Vector3())
  const originalCentre = originalBounds.isEmpty()
    ? new Vector3()
    : originalBounds.getCenter(new Vector3())
  return new Matrix4()
    .makeTranslation(originalCentre)
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(fileCentre.negate()))
    .multiply(LDRAW_TO_GAME)
}

// The matrix that shows the original's mesh (the drawing's frame) in the builder's (studs, the game's axes): a stud of the power-up
// brick is one, the bounds' bottom centre on the origin.
export const getPowerUpReferenceMatrix = (originalBounds: Box3): Matrix4 => {
  const centre = originalBounds.isEmpty()
    ? new Vector3()
    : originalBounds.getCenter(new Vector3()).setZ(originalBounds.min.z)
  return new Matrix4()
    .makeScale(1 / POWER_UP_STUD_UNITS, 1 / POWER_UP_STUD_UNITS, 1 / POWER_UP_STUD_UNITS)
    .multiply(new Matrix4().makeTranslation(centre.negate()))
}
