import type {
  FloatQuadruple,
  FloatTriple,
  TokenReader,
} from '../token-reader/token-reader.types.ts'

// On a mirrored track the exe's loaders negate y (e.g. TMB keywords 0x2c and 0x2d).
export const readFloatTriple = (reader: TokenReader, isMirrored = false): FloatTriple => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze([x, isMirrored ? -y : y, z] as const)
}

// Mirrored rotations negate y and w (RRB 0x004a4f36 and 0x004a4fd7).
export const readFloatQuadruple = (reader: TokenReader, isMirrored = false): FloatQuadruple => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  const w = reader.readFloat()
  return Object.freeze(isMirrored ? ([x, -y, z, -w] as const) : ([x, y, z, w] as const))
}
