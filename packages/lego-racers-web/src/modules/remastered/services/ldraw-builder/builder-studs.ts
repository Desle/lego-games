import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import { multiplyRotations, parsePartLine, rotateVector } from './builder-document.ts'
import { PART_UP } from './builder-rotation.ts'
import type { LibraryFileReader, PartStud, PartStudLists } from './builder-studs.types.ts'
import type { BuilderPartLine, Vector } from './ldraw-builder.types.ts'

const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const MAXIMUM_DEPTH = 6
// The library's primitives for a stud on a part (plain, open, with a logo, truncated, cross, with a hole); not the tubes underneath
// (stud3, stud4) nor Duplo, Scala or Quatro studs.
const STUD_PRIMITIVE =
  /^(stud|stud2|stud2a|studa|stud6a?|stud9|stud10|stud13|stud15|stud17a?|stud26|studel|studh[lr]?|studp01|studxa?)(-logo\d?)?\.dat$/i
// What may hold studs: a part's subparts, the stud groups and whole parts placed inside a part.
const STUD_HOLDER = /^(s[\\/].*|stug.*|[a-z]?\d{3,}.*)\.dat$/i

const getUnit = (vector: Vector): Vector => {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

const placeLine = (placement: BuilderPartLine, line: BuilderPartLine): BuilderPartLine => {
  const turned = rotateVector(placement.rotation, line.position)
  return Object.freeze({
    ...line,
    position: [
      turned[0] + placement.position[0],
      turned[1] + placement.position[1],
      turned[2] + placement.position[2],
    ] as const,
    rotation: multiplyRotations(placement.rotation, line.rotation),
  })
}

const collectStuds = async (
  placement: BuilderPartLine,
  readFile: LibraryFileReader,
  depth: number
): Promise<readonly PartStud[]> => {
  const text = depth > MAXIMUM_DEPTH ? null : await readFile(placement.partName)
  if (text === null) return []
  const lines = text
    .split(/\r?\n/)
    .map(parsePartLine)
    .filter((line): line is BuilderPartLine => line !== null)
  const found = await Promise.all(
    lines.map(async (line): Promise<readonly PartStud[]> => {
      const placed = placeLine(placement, line)
      if (STUD_PRIMITIVE.test(line.partName)) {
        return [
          Object.freeze({
            position: placed.position,
            direction: getUnit(rotateVector(placed.rotation, PART_UP)),
          }),
        ]
      }
      return STUD_HOLDER.test(line.partName) ? collectStuds(placed, readFile, depth + 1) : []
    })
  )
  return Object.freeze(found.flat())
}

// Every stud of a part, found from the stud primitives its file and subfiles place, each pointing the way its matrix turns it.
export const findPartStuds = (
  partName: string,
  readFile: LibraryFileReader
): Promise<readonly PartStud[]> =>
  collectStuds(
    { colorCode: 16, position: [0, 0, 0], rotation: IDENTITY_ROTATION, partName },
    readFile,
    0
  )

const fetchText = async (path: string): Promise<string | null> => {
  try {
    const response = await fetch(`${DEVELOPMENT_LDRAW_ROUTE}/${path}`)
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

// A part line names a file by its place under `parts/` or `p/` (`s\3001s01.dat` is `parts/s/3001s01.dat`).
const readLibraryFile: LibraryFileReader = async (name) => {
  const path = name.replace(/\\/g, '/')
  return (await fetchText(`parts/${path}`)) ?? fetchText(`p/${path}`)
}

// Each part's studs are read from the library once.
export const createPartStudLists = (
  readFile: LibraryFileReader = readLibraryFile
): PartStudLists => {
  const pending = new Map<string, Promise<readonly PartStud[]>>()
  const loaded = new Map<string, readonly PartStud[]>()
  const load = (partName: string): Promise<readonly PartStud[]> => {
    const key = partName.toLowerCase()
    const existing = pending.get(key)
    if (existing !== undefined) return existing
    const promise = findPartStuds(partName, readFile)
      .catch((): readonly PartStud[] => [])
      .then((studs) => {
        loaded.set(key, studs)
        return studs
      })
    pending.set(key, promise)
    return promise
  }
  return { load, getLoaded: (partName) => loaded.get(partName.toLowerCase()) }
}
