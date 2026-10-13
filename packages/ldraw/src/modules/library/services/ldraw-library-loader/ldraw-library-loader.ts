import type { Group } from 'three'
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { LDrawDetail } from './ldraw-library-loader.types.ts'

const COLOR_CONFIGURATION = 'LDConfig.ldr'

// The library's studs: a plain `stud.dat`, or a variant that carries the LEGO logo (level 1 thin lines, 2 outlined, 3 sharp 3D,
// 4 rounded 3D, 5 flattened 3D). Level 0 keeps the plain stud.
export const DEFAULT_STUD_LOGO_LEVEL = 4
export const MAXIMUM_STUD_LOGO_LEVEL = 5
const STUD_FILES = ['stud', 'stud2'] as const

const getStudFileMap = (logoLevel: number): Readonly<Record<string, string>> => {
  if (logoLevel <= 0) return Object.freeze({})
  const suffix = logoLevel === 1 ? '' : String(logoLevel)
  return Object.freeze(
    Object.fromEntries(STUD_FILES.map((name) => [`${name}.dat`, `${name}-logo${suffix}.dat`]))
  )
}

let studLogoLevel = DEFAULT_STUD_LOGO_LEVEL

// Takes effect for the loader made after it: set it before the first car is drawn.
export const setStudLogoLevel = (logoLevel: number) => {
  studLogoLevel = Math.max(0, Math.min(MAXIMUM_STUD_LOGO_LEVEL, Math.round(logoLevel)))
}

const loaderPromises = new Map<string, Promise<LDrawLoader>>()

// One loader for each library and detail, for every model: it keeps the parts it has read, so a part is fetched and built once. Only the
// parts a model names are fetched, with the primitives they use.
const getLoader = (libraryUrl: string, detail: LDrawDetail): Promise<LDrawLoader> => {
  const libraryPath = libraryUrl.endsWith('/') ? libraryUrl : `${libraryUrl}/`
  const key = `${libraryPath}|${detail}`
  const existing = loaderPromises.get(key)
  if (existing !== undefined) return existing
  const loader = new LDrawLoader()
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial)
  loader.setPath(libraryPath)
  loader.setPartsLibraryPath(libraryPath)
  loader.setFileMap(detail === LDrawDetail.LOW ? getStudFileMap(0) : getStudFileMap(studLogoLevel))
  const prepared = loader.preloadMaterials(COLOR_CONFIGURATION).then(() => loader)
  loaderPromises.set(key, prepared)
  return prepared
}

// `libraryUrl` is where the app serves the LDraw parts library (the folder that holds `LDConfig.ldr`, `parts/` and `p/`).
export const parseLDrawModel = async (
  text: string,
  libraryUrl: string,
  detail: LDrawDetail = LDrawDetail.HIGH
): Promise<Group> => {
  const loader = await getLoader(libraryUrl, detail)
  return new Promise<Group>((resolve, reject) => loader.parse(text, resolve, reject))
}
