import { readFloatQuadruple, readFloatTriple } from '../../../token-reader/index.ts'
import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import { createNameTable } from '../../../../shared/name-table/name-table.ts'
import type { NameTable } from '../../../../shared/name-table/name-table.types.ts'
import { BONE_NAME_LENGTH, SkeletonKeyword } from '../../types/skeleton-keyword/skeleton-keyword.ts'
import type {
  Bone,
  Skeleton,
  SkeletonQuaternion,
  SkeletonVector,
} from '../../types/skeleton.types.ts'

// 0x10029cb0..0x10029e2a: `0x27 "name" { keyword... }`; any other token inside is skipped.
const readBone = (reader: TokenReader, names: NameTable, index: number): Bone => {
  reader.expectToken(SkeletonKeyword.BONES)
  const name = reader.readStringWithMaximumLength(BONE_NAME_LENGTH)
  names.add(name, index)
  reader.expectLeftCurly()

  let position: SkeletonVector | null = null
  let quaternion: SkeletonQuaternion | null = null
  let parentIndex: number | null = null
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    if (keyword === SkeletonKeyword.POSITION) {
      position = readFloatTriple(reader)
    } else if (keyword === SkeletonKeyword.QUATERNION) {
      quaternion = readFloatQuadruple(reader)
    } else if (keyword === SkeletonKeyword.PARENT) {
      // 0x100283e0 searches the names added so far, this bone's own included.
      const parentName = reader.readStringWithMaximumLength(BONE_NAME_LENGTH)
      parentIndex = names.find(parentName) ?? reader.fail(TokenReaderFailure.INVALID_STRING)
    } else if (keyword === BinaryToken.END_OF_FILE) {
      throw new UnportableFileError(
        'Bone block without its closing curly loops forever in the original',
        reader.getPosition()
      )
    }
  }

  return Object.freeze({ name, position, quaternion, parentIndex })
}

// 0x10029c60: `[ count ] { bone... }`.
const readBones = (reader: TokenReader): readonly Bone[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const names = createNameTable()
  const bones: Bone[] = []
  for (let index = 0; index < count >>> 0; index++) bones.push(readBone(reader, names, index))
  reader.expectRightCurly()
  return Object.freeze(bones)
}

// GolDP.dll 0x10029a20: `0x27` blocks until the end of the file.
export const parseSkeleton = (bytes: Uint8Array): Skeleton => {
  const reader = createTokenReader(bytes)
  let bones: readonly Bone[] = Object.freeze([])
  for (
    let token = reader.getNextToken();
    token !== BinaryToken.END_OF_FILE;
    token = reader.getNextToken()
  ) {
    if (token !== SkeletonKeyword.BONES) reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    bones = readBones(reader)
  }
  return Object.freeze({ bones, readByteCount: reader.getPosition() })
}
