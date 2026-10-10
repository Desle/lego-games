export type SeededRandom = {
  readonly nextUnsignedInteger: () => number
  readonly nextFraction: () => number
  readonly nextIntegerBelow: (limit: number) => number
}

export type FloatSampler = {
  readonly sampleUniform: (limit: number) => number
  readonly sampleMagnitude: () => number
  readonly sampleEdge: () => number
  readonly sampleAnyBits: () => number
  readonly sampleIntegerBelow: (limit: number) => number
  readonly getIsChance: (percent: number) => boolean
  readonly sampleAngle: (limit: number) => number
  readonly sampleMixed: (limit: number) => number
  readonly sampleList: (count: number, limit: number) => readonly number[]
}
