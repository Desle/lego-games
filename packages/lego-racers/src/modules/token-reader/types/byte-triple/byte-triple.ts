import { getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import type { ByteTriple, TokenReader } from '../token-reader/token-reader.types.ts'

// Three integer tokens kept as unsigned bytes, as the texture, image and font database loaders store them.
export const readByteTriple = (reader: TokenReader): ByteTriple => {
  const first = getUnsignedByte(reader.readInteger())
  const second = getUnsignedByte(reader.readInteger())
  const third = getUnsignedByte(reader.readInteger())
  return Object.freeze([first, second, third] as const)
}
