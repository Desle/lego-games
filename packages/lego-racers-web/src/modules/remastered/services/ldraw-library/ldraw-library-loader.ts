import type { Group } from 'three'
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { addLoadMilliseconds } from '../performance-monitor/performance-monitor.ts'
import { DEVELOPMENT_LDRAW_ROUTE } from './ldraw-library-route.ts'

const LIBRARY_PATH = `${DEVELOPMENT_LDRAW_ROUTE}/`
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

let loaderPromise: Promise<LDrawLoader> | null = null

// One loader for every car: it keeps the parts it has read, so a part is fetched and built once. Only the parts a car names are
// fetched, with the primitives they use.
const getLoader = (): Promise<LDrawLoader> => {
  if (loaderPromise !== null) return loaderPromise
  const loader = new LDrawLoader()
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial)
  loader.setFileMap(getStudFileMap(studLogoLevel))
  loader.setPath(LIBRARY_PATH)
  loader.setPartsLibraryPath(LIBRARY_PATH)
  loaderPromise = loader.preloadMaterials(COLOR_CONFIGURATION).then(() => loader)
  return loaderPromise
}

// An LDraw model (type 1 lines naming library parts) as three.js objects in the library's axes and units.
// The wall time the library spends delivering parts counts once however many models are in flight (the monitor's load time).
let pendingModelCount = 0
let busySince = 0

const finishModel = () => {
  pendingModelCount -= 1
  if (pendingModelCount === 0) addLoadMilliseconds(performance.now() - busySince)
}

export const parseLDrawModel = async (text: string): Promise<Group> => {
  if (pendingModelCount === 0) busySince = performance.now()
  pendingModelCount += 1
  try {
    const loader = await getLoader()
    return await new Promise<Group>((resolve, reject) => loader.parse(text, resolve, reject))
  } finally {
    finishModel()
  }
}
