import { decodeBitmap, getBitmapColors, type Bitmap } from '../../../bitmap/index.ts'
import { JamLookupError } from '../../../jam-archive/index.ts'
import { decodeTarga } from '../../../targa/index.ts'
import { parseTextureDatabase } from '../../../texture-database/index.ts'
import type { TextureDefinition } from '../../../texture-database/index.ts'
import { MissingBitmapReason } from '../../types/scene-enums/scene-enums.ts'
import {
  getArchivePath,
  getNameWithDefaultExtension,
  getNameWithImageExtension,
} from '../../types/scene-path/scene-path.ts'
import type { SceneBitmap, SceneTexture } from '../../types/scene.types.ts'
import { getKeyedPalette, getKeyedTrueColors } from '../../types/texture-colors/texture-colors.ts'
import type { LinkedTextures, SceneFileSource } from './load-scene.types.ts'

// 0x10017ac0 appends ".tdf" (0x1005cbd4); the reader's default extension ".tdb" (0x1005cf10) replaces it.
const TEXTURE_LIST_EXTENSION = '.tdf'
const TEXTURE_DATABASE_EXTENSION = '.tdb'
// Texture flag 8 (TDB keyword 0x2a) loads a bitmap (0x10064280, ".bmp" at 0x1005cbe4); flag 0x10
// (keyword 0x2b) a Targa (0x10063ca0, ".tga" at 0x1005cf00). 0x1001f330 and 0x1002b890 choose this way.
const TARGA_FLAG = 0x10
// Texture flag 4 (keyword 0x28) keeps a Targa's first row on top (0x1002ae50).
const FIRST_ROW_ON_TOP_FLAG = 0x4
const COLOR_KEY_FLAG = 0x20
const BITMAP_EXTENSION = '.bmp'
const TARGA_EXTENSION = '.tga'

const getIsFilePresent = (source: SceneFileSource, path: string): boolean => {
  try {
    source.archive.findFile(path)
    return true
  } catch (error) {
    if (error instanceof JamLookupError) return false
    throw error
  }
}

const getDecodedBitmap = (
  bitmap: Bitmap,
  colorKey: readonly [number, number, number] | null
): SceneBitmap => {
  if (colorKey === null) {
    return Object.freeze({
      width: bitmap.width,
      height: bitmap.height,
      colors: getBitmapColors(bitmap),
    })
  }
  const keyedBitmap = { ...bitmap, palette: getKeyedPalette(bitmap, colorKey) }
  const colors = getBitmapColors(keyedBitmap)
  return Object.freeze({
    width: bitmap.width,
    height: bitmap.height,
    colors: bitmap.bitsPerPixel > 8 ? getKeyedTrueColors(colors, colorKey) : colors,
  })
}

const getLinkedTexture = (source: SceneFileSource, definition: TextureDefinition): SceneTexture => {
  const isTarga = (definition.flags & TARGA_FLAG) !== 0
  const colorKey = (definition.flags & COLOR_KEY_FLAG) === 0 ? null : definition.keyword2cBytes
  const bitmapPath = getArchivePath(
    source.directory,
    getNameWithImageExtension(definition.name, isTarga ? TARGA_EXTENSION : BITMAP_EXTENSION)
  )
  const missingBitmapReason = getIsFilePresent(source, bitmapPath)
    ? null
    : MissingBitmapReason.FILE_NOT_FOUND
  const getImage = (bytes: Uint8Array): Bitmap =>
    isTarga
      ? decodeTarga(bytes, { isFirstRowOnTop: (definition.flags & FIRST_ROW_ON_TOP_FLAG) !== 0 })
      : decodeBitmap(bytes)
  return Object.freeze({
    name: definition.name,
    bitmapPath,
    bitmap:
      missingBitmapReason === null
        ? getDecodedBitmap(getImage(source.archive.readFile(bitmapPath)), colorKey)
        : null,
    missingBitmapReason,
    colorKey: colorKey === null ? null : (Object.freeze([...colorKey]) as SceneTexture['colorKey']),
    flags: definition.flags,
  })
}

// GolDP.dll 0x1002b5a0 for each name in the world's texture list, in order: a name already registered in
// the chain (0x10028b90) is not registered again, so the first database to define it wins. The chain lives
// in the container every world of a race is loaded into, so earlier worlds' textures stay visible.
export const linkTextures = (
  source: SceneFileSource,
  databaseNames: readonly string[],
  earlier: LinkedTextures
): LinkedTextures => {
  const textures: SceneTexture[] = [...earlier.textures]
  const indexByName = new Map(earlier.indexByName)
  for (const databaseName of databaseNames) {
    const path = getArchivePath(
      source.directory,
      getNameWithDefaultExtension(databaseName + TEXTURE_LIST_EXTENSION, TEXTURE_DATABASE_EXTENSION)
    )
    for (const definition of parseTextureDatabase(source.archive.readFile(path)).textures) {
      if (!definition.isNameRegistered || indexByName.has(definition.name)) continue
      indexByName.set(definition.name, textures.length)
      textures.push(getLinkedTexture(source, definition))
    }
  }
  return Object.freeze({ textures: Object.freeze(textures), indexByName })
}
