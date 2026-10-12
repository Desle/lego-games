import { posix } from 'node:path'
import type { SceneBitmap, SceneTexture } from '@lego-games/lego-racers/scene'
import { AssetType } from '../../types/asset-type/asset-type.ts'
import type { OutputWriter } from '../../types/export.types.ts'
import {
  getColorKeyedTextureFile,
  getDirectoryOfFile,
  getTextureFile,
} from '../../services/export-paths/export-paths.ts'
import { encodePng } from '../../services/png-encoder/png-encoder.ts'
import type { TextureReferences } from './texture-references.types.ts'

const ALPHA_OFFSET = 3
const COLOR_STRIDE = 4
const OPAQUE = 255

export const getHasTransparentPixels = (bitmap: SceneBitmap): boolean => {
  for (let index = ALPHA_OFFSET; index < bitmap.colors.length; index += COLOR_STRIDE) {
    if ((bitmap.colors[index] ?? OPAQUE) < OPAQUE) return true
  }
  return false
}

// A colour-keyed picture is exported as written under textures/, which is opaque; a model needs the keyed pixels
// transparent, so those pictures are written once more under textures/COLORKEYED/.
export const createTextureReferences = (writer: OutputWriter): TextureReferences => {
  const writtenFiles = new Set<string>()
  const getTextureFileOf = (texture: SceneTexture, bitmap: SceneBitmap): string => {
    if (/\.tga$/i.test(texture.bitmapPath) || !getHasTransparentPixels(bitmap)) {
      return getTextureFile(texture.bitmapPath)
    }
    const file = getColorKeyedTextureFile(texture.bitmapPath)
    if (!writtenFiles.has(file)) {
      writtenFiles.add(file)
      writer.writeFile(file, encodePng(bitmap), AssetType.TEXTURE, texture.bitmapPath)
    }
    return file
  }
  return Object.freeze({
    getTextureUri: (modelFile, texture) => {
      if (texture.bitmap === null) return null
      const relative = posix.relative(
        getDirectoryOfFile(modelFile),
        getTextureFileOf(texture, texture.bitmap)
      )
      return relative.split('/').map(encodeURIComponent).join('/')
    },
  })
}
