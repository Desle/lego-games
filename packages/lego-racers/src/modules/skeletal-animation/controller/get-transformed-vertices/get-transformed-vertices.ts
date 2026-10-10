import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { BoneMatrices } from '../../types/skeletal-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, multiply, storeFloat } = arithmetic

const MATRIX_SIZE = 16
const ROW_SIZE = 4
const TRANSLATION_ROW_START = 12
const COMPONENT_COUNT = 3

// GolDP.dll 0x1000c630: `x · m[0][j] + y · m[1][j]`, then `+ z · m[2][j]`, then `+ m[3][j]` (translation).
const getTransformedComponent = (
  source: Float32Array,
  start: number,
  matrices: BoneMatrices,
  matrixStart: number,
  column: number,
  isTranslated: boolean
): number => {
  const getTerm = (row: number): number =>
    multiply(source[start + row] ?? 0, matrices[matrixStart + row * ROW_SIZE + column] ?? 0)
  const sum = add(add(getTerm(0), getTerm(1)), getTerm(2))
  return storeFloat(
    isTranslated ? add(sum, matrices[matrixStart + TRANSLATION_ROW_START + column] ?? 0) : sum
  )
}

const getTransformed = (
  source: Float32Array,
  transformIndices: Uint8Array,
  matrices: BoneMatrices,
  isTranslated: boolean
): Float32Array => {
  const boneCount = matrices.length / MATRIX_SIZE
  const target = new Float32Array(source.length)
  for (let corner = 0; corner < transformIndices.length; corner++) {
    const start = corner * COMPONENT_COUNT
    const bone = transformIndices[corner] ?? 0
    if (bone >= boneCount) {
      target.set(source.subarray(start, start + COMPONENT_COUNT), start)
      continue
    }
    for (let column = 0; column < COMPONENT_COUNT; column++) {
      target[start + column] = getTransformedComponent(
        source,
        start,
        matrices,
        bone * MATRIX_SIZE,
        column,
        isTranslated
      )
    }
  }
  return target
}

// 0x1000c630 for the corners of a batch: each corner's position is a row vector times the matrix of the bone
// that was selected when its vertex was transformed (`transformIndices`); a bone the skeleton does not have
// leaves the corner as it is.
export const getTransformedPositions = (
  positions: Float32Array,
  transformIndices: Uint8Array,
  matrices: BoneMatrices
): Float32Array => getTransformed(positions, transformIndices, matrices, true)

// The same rows without the translation, for normals (the bone matrices are rigid, so nothing is rescaled).
export const getTransformedNormals = (
  normals: Float32Array,
  transformIndices: Uint8Array,
  matrices: BoneMatrices
): Float32Array => getTransformed(normals, transformIndices, matrices, false)
