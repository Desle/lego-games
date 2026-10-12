import type { GltfQuaternion } from '../gltf-builder/gltf-builder.types.ts'

const MATRIX_SIZE = 4

// The engine's rotations are row-vector 3×3 matrices (row n is the image of axis n); glTF's are column-vector, so the
// quaternion comes from the transpose.
export const getQuaternionOfRowRotation = (rows: readonly number[]): GltfQuaternion => {
  const entry = (row: number, column: number): number => rows[column * 3 + row] ?? 0
  const trace = entry(0, 0) + entry(1, 1) + entry(2, 2)
  const raw = ((): readonly [number, number, number, number] => {
    if (trace > 0) {
      const scale = Math.sqrt(trace + 1) * 2
      return [
        (entry(2, 1) - entry(1, 2)) / scale,
        (entry(0, 2) - entry(2, 0)) / scale,
        (entry(1, 0) - entry(0, 1)) / scale,
        scale / 4,
      ]
    }
    if (entry(0, 0) > entry(1, 1) && entry(0, 0) > entry(2, 2)) {
      const scale = Math.sqrt(1 + entry(0, 0) - entry(1, 1) - entry(2, 2)) * 2
      return [
        scale / 4,
        (entry(0, 1) + entry(1, 0)) / scale,
        (entry(0, 2) + entry(2, 0)) / scale,
        (entry(2, 1) - entry(1, 2)) / scale,
      ]
    }
    if (entry(1, 1) > entry(2, 2)) {
      const scale = Math.sqrt(1 + entry(1, 1) - entry(0, 0) - entry(2, 2)) * 2
      return [
        (entry(0, 1) + entry(1, 0)) / scale,
        scale / 4,
        (entry(1, 2) + entry(2, 1)) / scale,
        (entry(0, 2) - entry(2, 0)) / scale,
      ]
    }
    const scale = Math.sqrt(1 + entry(2, 2) - entry(0, 0) - entry(1, 1)) * 2
    return [
      (entry(0, 2) + entry(2, 0)) / scale,
      (entry(1, 2) + entry(2, 1)) / scale,
      scale / 4,
      (entry(1, 0) - entry(0, 1)) / scale,
    ]
  })()
  const length = Math.hypot(...raw) || 1
  return [raw[0] / length, raw[1] / length, raw[2] / length, raw[3] / length]
}

// The quaternion that follows `previous` without flipping sign (the same rotation, the nearer of q and -q).
export const getNearerQuaternion = (
  previous: GltfQuaternion,
  quaternion: GltfQuaternion
): GltfQuaternion => {
  const dot = previous.reduce((sum, value, index) => sum + value * (quaternion[index] ?? 0), 0)
  return dot < 0 ? [-quaternion[0], -quaternion[1], -quaternion[2], -quaternion[3]] : quaternion
}

// Gauss-Jordan inverse of a 4×4 matrix stored as 16 numbers (an inverse transposes with its matrix, so the storage
// order does not matter).
export const getInverseMatrix = (matrix: ArrayLike<number>): Float32Array => {
  const size = MATRIX_SIZE
  const work = Array.from({ length: size }, (_unused, row) =>
    Array.from({ length: size * 2 }, (_value, column) =>
      column < size ? (matrix[row * size + column] ?? 0) : column - size === row ? 1 : 0
    )
  )
  for (let column = 0; column < size; column++) {
    const pivotRow = work.reduce(
      (best, candidate, row) =>
        row >= column && Math.abs(candidate[column] ?? 0) > Math.abs(work[best]?.[column] ?? 0)
          ? row
          : best,
      column
    )
    const pivotValues = work[pivotRow] ?? []
    const pivot = pivotValues[column] || 1
    work[pivotRow] = work[column] ?? []
    work[column] = pivotValues.map((value) => value / pivot)
    for (let row = 0; row < size; row++) {
      if (row === column) continue
      const factor = work[row]?.[column] ?? 0
      work[row] = (work[row] ?? []).map(
        (value, index) => value - factor * (work[column]?.[index] ?? 0)
      )
    }
  }
  return Float32Array.from(work.flatMap((row) => row.slice(size)))
}
