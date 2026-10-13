import type {
  ModelChoice,
  ModelFile,
  ModelFolder,
  ModelTextReader,
} from '../../types/studio.types.ts'

const ROOT_FOLDER = '/'
const MODEL_REFERENCE = /^1(?:\s+\S+){13}\s+(.+\.(?:ldr|mpd))$/i
const FILE_LINE = /^0\s+FILE\s+(.+)$/i

const getIsModelFile = (value: unknown): value is ModelFile =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'path') === 'string' &&
  typeof Reflect.get(value, 'modifiedMilliseconds') === 'number'

// The model files of a `files.json` answer in its order (by path); anything else in it is left out.
export const readModelFiles = (value: unknown): readonly ModelFile[] =>
  Object.freeze(
    (Array.isArray(value) ? value : [])
      .filter(getIsModelFile)
      .map((file) =>
        Object.freeze({ path: file.path, modifiedMilliseconds: file.modifiedMilliseconds })
      )
  )

const getFolder = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ROOT_FOLDER

const getFileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

// The files by folder, the models folder's own first, then each subfolder by name.
export const groupModelFiles = (files: readonly ModelFile[]): readonly ModelFolder[] => {
  const folders = new Map<string, ModelChoice[]>()
  for (const { path } of files) {
    const folder = getFolder(path)
    folders.set(folder, [
      ...(folders.get(folder) ?? []),
      Object.freeze({ path, name: getFileName(path) }),
    ])
  }
  return Object.freeze(
    [...folders]
      .toSorted(([first], [second]) =>
        first === ROOT_FOLDER ? -1 : second === ROOT_FOLDER ? 1 : first.localeCompare(second)
      )
      .map(([folder, folderFiles]) => Object.freeze({ folder, files: Object.freeze(folderFiles) }))
  )
}

// The `.ldr` and `.mpd` files a model places but does not hold itself (no `0 FILE` of that name), as its lines name them.
export const getMissingModelNames = (text: string): readonly string[] => {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const defined = new Set(
    lines.flatMap((line) => {
      const name = FILE_LINE.exec(line)?.[1]
      return name === undefined ? [] : [name.trim().toLowerCase()]
    })
  )
  const referenced = lines.flatMap((line) => {
    const name = MODEL_REFERENCE.exec(line)?.[1]
    return name === undefined ? [] : [name.trim()]
  })
  return Object.freeze(
    referenced.filter(
      (name, index) =>
        !defined.has(name.toLowerCase()) &&
        referenced.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index
    )
  )
}

// The models folder's file of that name in any folder, by its name without regard to case (a car names its chassis `rrchas0.ldr`).
export const findModelFile = (files: readonly ModelFile[], name: string): ModelFile | null =>
  files.find((file) => getFileName(file.path).toLowerCase() === name.toLowerCase()) ?? null

// A model's text with every other model file it places, at any depth, added as a `0 FILE` section, so the viewer, which reads no
// files, gets the whole model. A name with no file in the folder is left to the library.
export const collectModelText = async (
  path: string,
  files: readonly ModelFile[],
  readText: ModelTextReader
): Promise<string | null> => {
  const main = await readText(path)
  if (main === null) return null
  const sections = [main]
  const added = new Set([getFileName(path).toLowerCase()])
  const findUnadded = () =>
    getMissingModelNames(sections.join('\n')).flatMap((name) => {
      const file = findModelFile(files, name)
      if (file === null || added.has(name.toLowerCase())) return []
      added.add(name.toLowerCase())
      return [{ name, file }]
    })
  for (let found = findUnadded(); found.length > 0; found = findUnadded()) {
    const texts = await Promise.all(
      found.map(async ({ name, file }) => {
        const text = await readText(file.path)
        return text === null ? null : `0 FILE ${name}\n${text}`
      })
    )
    sections.push(...texts.filter((text): text is string => text !== null))
  }
  return sections.join('\n')
}
