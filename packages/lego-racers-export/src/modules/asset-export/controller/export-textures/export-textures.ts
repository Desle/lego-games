import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeBitmap, getBitmapColors } from '@lego-games/lego-racers/bitmap'
import type { Bitmap } from '@lego-games/lego-racers/bitmap'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { decodeTarga } from '@lego-games/lego-racers/targa'
import { AssetType } from '../../types/asset-type/asset-type.ts'
import type { ExportReport, OutputWriter, RgbaImage } from '../../types/export.types.ts'
import {
  getErrorMessage,
  getGameFolderTextureFile,
  getTextureFile,
} from '../../services/export-paths/export-paths.ts'
import { encodePng } from '../../services/png-encoder/png-encoder.ts'
import { decodeWindowsBitmap } from '../../services/windows-bitmap/windows-bitmap.ts'

const BITS_PER_PIXEL_WITH_ALPHA = 32
const OPAQUE = 255

// Transparency of a palette picture comes from the material's colour key, not from the picture, so only 32-bit
// pictures (the TGAs) keep their alpha.
const getImage = (bitmap: Bitmap): RgbaImage => {
  const colors = getBitmapColors(bitmap)
  if (bitmap.bitsPerPixel !== BITS_PER_PIXEL_WITH_ALPHA) {
    for (let index = 3; index < colors.length; index += 4) colors[index] = OPAQUE
  }
  return Object.freeze({ width: bitmap.width, height: bitmap.height, colors })
}

const getArchiveImage = (archive: JamArchive, path: string): RgbaImage =>
  /\.tga$/i.test(path)
    ? getImage(decodeTarga(archive.readFile(path), { isFirstRowOnTop: true }))
    : getImage(decodeBitmap(archive.readFile(path)))

const getGameFolderImage = (gameDirectory: string, name: string): RgbaImage =>
  decodeWindowsBitmap(new Uint8Array(readFileSync(join(gameDirectory, name))))

// Every BMP and TGA of LEGO.JAM at its archive path, and the loose BMPs of the game folder under GAMEFOLDER.
export const exportTextures = (
  archive: JamArchive,
  gameDirectory: string,
  writer: OutputWriter
): ExportReport => {
  const failures: string[] = []
  let writtenCount = 0
  const exportImage = (file: string, source: string, getImageToWrite: () => RgbaImage): void => {
    try {
      writer.writeFile(file, encodePng(getImageToWrite()), AssetType.TEXTURE, source)
      writtenCount++
    } catch (error) {
      failures.push(`${source}: ${getErrorMessage(error)}`)
    }
  }
  for (const path of archive
    .getFilePaths()
    .filter((candidate) => /\.(bmp|tga)$/i.test(candidate))) {
    exportImage(getTextureFile(path), path, () => getArchiveImage(archive, path))
  }
  for (const name of readdirSync(gameDirectory).filter((candidate) => /\.bmp$/i.test(candidate))) {
    exportImage(getGameFolderTextureFile(name), name, () => getGameFolderImage(gameDirectory, name))
  }
  return Object.freeze({ label: 'textures', writtenCount, failures, skipMessage: null })
}
