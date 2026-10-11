import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'

export const getFloatWords = (values: readonly number[]): readonly number[] =>
  values.map((value) => getBitsFromFloat(value))

export const getVectorWords = (vector: Vector3): readonly number[] =>
  getFloatWords([vector.x, vector.y, vector.z])
