import type { Group } from 'three'
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { DEVELOPMENT_LDRAW_ROUTE } from './ldraw-library-route.ts'

const LIBRARY_PATH = `${DEVELOPMENT_LDRAW_ROUTE}/`
const COLOR_CONFIGURATION = 'LDConfig.ldr'

let loaderPromise: Promise<LDrawLoader> | null = null

// One loader for every car: it keeps the parts it has read, so a part is fetched and built once. Only the parts a car names are
// fetched, with the primitives they use.
const getLoader = (): Promise<LDrawLoader> => {
  if (loaderPromise !== null) return loaderPromise
  const loader = new LDrawLoader()
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial)
  loader.setPath(LIBRARY_PATH)
  loader.setPartsLibraryPath(LIBRARY_PATH)
  loaderPromise = loader.preloadMaterials(COLOR_CONFIGURATION).then(() => loader)
  return loaderPromise
}

// An LDraw model (type 1 lines naming library parts) as three.js objects in the library's axes and units.
export const parseLDrawModel = async (text: string): Promise<Group> => {
  const loader = await getLoader()
  return new Promise<Group>((resolve, reject) => loader.parse(text, resolve, reject))
}
