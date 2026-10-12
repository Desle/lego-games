const TEXTURE_DIRECTORY = 'textures'
const COLOR_KEYED_DIRECTORY = 'COLORKEYED'

const getPortablePath = (archivePath: string): string => archivePath.replaceAll('\\', '/')

const getWithExtension = (path: string, extension: string): string =>
  path.replace(/\.[^./]*$/, '') + extension

// textures/<archive path>.png
export const getTextureFile = (archivePath: string): string =>
  `${TEXTURE_DIRECTORY}/${getWithExtension(getPortablePath(archivePath), '.png')}`

// The same picture with the material's colour key made transparent, for models.
export const getColorKeyedTextureFile = (archivePath: string): string =>
  `${TEXTURE_DIRECTORY}/${COLOR_KEYED_DIRECTORY}/${getWithExtension(getPortablePath(archivePath), '.png')}`

export const getGameFolderTextureFile = (fileName: string): string =>
  `${TEXTURE_DIRECTORY}/GAMEFOLDER/${getWithExtension(fileName, '.png')}`

// <prefix>/<archive path with the extension replaced>
export const getMirroredFile = (prefix: string, archivePath: string, extension: string): string =>
  `${prefix}/${getWithExtension(getPortablePath(archivePath), extension)}`

export const getDirectoryOfFile = (file: string): string => {
  const separatorIndex = file.lastIndexOf('/')
  return separatorIndex < 0 ? '' : file.slice(0, separatorIndex)
}

export const getBaseName = (path: string): string => {
  const portable = getPortablePath(path)
  return getWithExtension(portable.slice(portable.lastIndexOf('/') + 1), '')
}

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// The archive folder of an archive path ("" for a file at the root), with backslashes.
export const getArchiveDirectory = (archivePath: string): string =>
  archivePath.slice(0, Math.max(archivePath.lastIndexOf('\\'), 0))
