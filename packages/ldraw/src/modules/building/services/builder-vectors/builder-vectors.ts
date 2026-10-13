import type { Vector } from '../../types/building.types.ts'

export const addVectors = (first: Vector, second: Vector): Vector => [
  first[0] + second[0],
  first[1] + second[1],
  first[2] + second[2],
]

export const getVectorDifference = (first: Vector, second: Vector): Vector => [
  first[0] - second[0],
  first[1] - second[1],
  first[2] - second[2],
]
