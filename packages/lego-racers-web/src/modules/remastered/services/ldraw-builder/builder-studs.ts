import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import { multiplyRotations, parsePartLine, rotateVector } from './builder-document.ts'
import { PART_UP } from './builder-rotation.ts'
import type {
  CollectedGeometry,
  LibraryFileReader,
  PartShape,
  PartShapes,
  PartStud,
} from './builder-studs.types.ts'
import type { BuilderBox, BuilderPartLine, Vector } from './ldraw-builder.types.ts'

const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const MAXIMUM_DEPTH = 12
const LEVEL_TOLERANCE = 0.001
const STUD_CELL = 10
const OVERLAP = 0.5
const PLATE_HEIGHT = 8
const UPWARD = 0.99
// The library's primitives for a stud on a part (plain, open, with a logo, truncated, cross, with a hole); not the tubes underneath
// (stud3, stud4) nor Duplo, Scala or Quatro studs.
const STUD_PRIMITIVE =
  /^(stud|stud2|stud2a|studa|stud6a?|stud9|stud10|stud13|stud15|stud17a?|stud26|studel|studh[lr]?|studp01|studxa?)(-logo\d?)?\.dat$/i
const FACE_LINE = /^([34])\s+\S+((?:\s+-?[\d.eE+-]+){9,12})\s*$/
const EMPTY_SHAPE: PartShape = Object.freeze({
  studs: [],
  box: null,
  footprint: null,
  bottom: null,
})

const getUnit = (vector: Vector): Vector => {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

const placePoint = (placement: BuilderPartLine, point: Vector): Vector => {
  const turned = rotateVector(placement.rotation, point)
  return [
    turned[0] + placement.position[0],
    turned[1] + placement.position[1],
    turned[2] + placement.position[2],
  ]
}

const placeLine = (placement: BuilderPartLine, line: BuilderPartLine): BuilderPartLine =>
  Object.freeze({
    ...line,
    position: placePoint(placement, line.position),
    rotation: multiplyRotations(placement.rotation, line.rotation),
  })

const parseFace = (placement: BuilderPartLine, line: string): readonly Vector[] | null => {
  const match = FACE_LINE.exec(line.trim())
  if (match === null) return null
  const numbers = (match[2] ?? '').trim().split(/\s+/).map(Number)
  const count = match[1] === '3' ? 3 : 4
  if (numbers.length !== count * 3 || numbers.some((value) => !Number.isFinite(value))) return null
  return Array.from({ length: count }, (_unused, corner) =>
    placePoint(placement, [
      numbers[corner * 3] ?? 0,
      numbers[corner * 3 + 1] ?? 0,
      numbers[corner * 3 + 2] ?? 0,
    ])
  )
}

const collect = async (
  placement: BuilderPartLine,
  readFile: LibraryFileReader,
  depth: number
): Promise<CollectedGeometry> => {
  const text = depth > MAXIMUM_DEPTH ? null : await readFile(placement.partName)
  if (text === null) return { studs: [], faces: [] }
  const lines = text.split(/\r?\n/)
  const faces = lines
    .map((line) => parseFace(placement, line))
    .filter((face): face is readonly Vector[] => face !== null)
  const found = await Promise.all(
    lines
      .map(parsePartLine)
      .filter((line): line is BuilderPartLine => line !== null)
      .map(async (line): Promise<CollectedGeometry> => {
        const placed = placeLine(placement, line)
        const child = await collect(placed, readFile, depth + 1)
        if (!STUD_PRIMITIVE.test(line.partName)) return child
        const stud: PartStud = Object.freeze({
          position: placed.position,
          direction: getUnit(rotateVector(placed.rotation, PART_UP)),
        })
        return { studs: [stud], faces: child.faces }
      })
  )
  return {
    studs: found.flatMap((child) => child.studs),
    faces: [...faces, ...found.flatMap((child) => child.faces)],
  }
}

const getBoxOf = (points: readonly Vector[]): BuilderBox | null => {
  if (points.length === 0) return null
  const getLeast = (axis: 0 | 1 | 2) =>
    points.reduce((least, point) => Math.min(least, point[axis]), Infinity)
  const getMost = (axis: 0 | 1 | 2) =>
    points.reduce((most, point) => Math.max(most, point[axis]), -Infinity)
  return Object.freeze({
    minimum: [getLeast(0), getLeast(1), getLeast(2)] as const,
    maximum: [getMost(0), getMost(1), getMost(2)] as const,
  })
}

const getIsLevel = (face: readonly Vector[]): boolean => {
  const heights = face.map((point) => point[1])
  return Math.max(...heights) - Math.min(...heights) < LEVEL_TOLERANCE
}

const getIsInsideCells = (point: Vector, upward: readonly PartStud[]): boolean =>
  upward.some(
    (stud) =>
      Math.abs(point[0] - stud.position[0]) < STUD_CELL - OVERLAP &&
      Math.abs(point[2] - stud.position[2]) < STUD_CELL - OVERLAP
  ) ||
  [-OVERLAP, OVERLAP].every((stepX) =>
    [-OVERLAP, OVERLAP].every((stepZ) =>
      upward.some(
        (stud) =>
          Math.abs(point[0] + stepX - stud.position[0]) <= STUD_CELL &&
          Math.abs(point[2] + stepZ - stud.position[2]) <= STUD_CELL
      )
    )
  )

const getIsTouchingCells = (face: readonly Vector[], upward: readonly PartStud[]): boolean => {
  const box = getBoxOf(face)
  return (
    box !== null &&
    upward.some(
      (stud) =>
        box.minimum[0] <= stud.position[0] + STUD_CELL &&
        box.maximum[0] >= stud.position[0] - STUD_CELL &&
        box.minimum[2] <= stud.position[2] + STUD_CELL &&
        box.maximum[2] >= stud.position[2] - STUD_CELL
    )
  )
}

// The lowest level with faces next to or under the studs that, together, are at least half a stud each way across: a body's bottom
// beside its studs (a curved brick's front), not a bracket's leg.
const getLowestBodyLevel = (
  faces: readonly (readonly Vector[])[],
  upward: readonly PartStud[]
): number => {
  const levels = new Map<number, (readonly Vector[])[]>()
  for (const face of faces.filter(getIsLevel)) {
    const level = Math.round((face[0]?.[1] ?? 0) / LEVEL_TOLERANCE) * LEVEL_TOLERANCE
    levels.set(level, [...(levels.get(level) ?? []), face])
  }
  return [...levels].reduce((lowest, [level, levelFaces]) => {
    const box = getBoxOf(levelFaces.flat())
    const isBody =
      box !== null &&
      box.maximum[0] - box.minimum[0] >= STUD_CELL &&
      box.maximum[2] - box.minimum[2] >= STUD_CELL &&
      levelFaces.some((face) => getIsTouchingCells(face, upward))
    return isBody ? Math.max(lowest, level) : lowest
  }, -Infinity)
}

// How far down a part reaches under its upward studs, or with its body's bottom beside them: what it stands on. Handles, clips, wheel
// pins and a bracket's leg beside its studs hang lower; a pin hole, a wheel holder or a round bottom under them do not. Less than a
// plate under its top studs is a hollow shell (a windscreen's stud plate): it stands on its box's bottom.
const getBottom = (
  faces: readonly (readonly Vector[])[],
  upward: readonly PartStud[]
): number | null => {
  if (upward.length === 0) return null
  const top = upward.reduce((high, stud) => Math.min(high, stud.position[1]), Infinity)
  const lowest = Math.max(
    faces
      .flat()
      .filter((point) => getIsInsideCells(point, upward))
      .reduce((low, point) => Math.max(low, point[1]), -Infinity),
    getLowestBodyLevel(faces, upward)
  )
  return lowest >= top + PLATE_HEIGHT - LEVEL_TOLERANCE ? lowest : null
}

const getIsUnderStud = (face: readonly Vector[], stud: PartStud): boolean => {
  const getIsOverlapping = (axis: 0 | 2) => {
    const values = face.map((point) => point[axis])
    const centre = stud.position[axis]
    return (
      Math.min(...values) < centre + STUD_CELL - OVERLAP &&
      Math.max(...values) > centre - STUD_CELL + OVERLAP
    )
  }
  return getIsOverlapping(0) && getIsOverlapping(2)
}

// The faces at the lowest level under a part's upward studs (or anywhere, without them): where its anti-studs are across.
const getFootprint = (
  faces: readonly (readonly Vector[])[],
  upward: readonly PartStud[]
): BuilderBox | null => {
  const levelFaces = faces
    .filter(getIsLevel)
    .filter((face) => upward.length === 0 || upward.some((stud) => getIsUnderStud(face, stud)))
  const lowest = levelFaces.reduce((low, face) => Math.max(low, face[0]?.[1] ?? low), -Infinity)
  return getBoxOf(
    levelFaces.filter((face) => Math.abs((face[0]?.[1] ?? 0) - lowest) < LEVEL_TOLERANCE).flat()
  )
}

// A part's studs (found from the stud primitives its file and subfiles place, each pointing the way its matrix turns it), the box of
// its faces and its footprint.
export const findPartShape = async (
  partName: string,
  readFile: LibraryFileReader
): Promise<PartShape> => {
  const { studs, faces } = await collect(
    { colorCode: 16, position: [0, 0, 0], rotation: IDENTITY_ROTATION, partName },
    readFile,
    0
  )
  const upward = studs.filter((stud) => stud.direction[1] < -UPWARD)
  return Object.freeze({
    studs: Object.freeze(studs),
    box: getBoxOf(faces.flat()),
    footprint: getFootprint(faces, upward),
    bottom: getBottom(faces, upward),
  })
}

const fetchText = async (path: string): Promise<string | null> => {
  try {
    const response = await fetch(`${DEVELOPMENT_LDRAW_ROUTE}/${path}`)
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

// A part line names a file by its place under `parts/` or `p/` (`s\3001s01.dat` is `parts/s/3001s01.dat`).
const readLibraryFile = async (name: string): Promise<string | null> => {
  const path = name.replace(/\\/g, '/').toLowerCase()
  return (await fetchText(`parts/${path}`)) ?? fetchText(`p/${path}`)
}

// Each library file is read once, however many parts place it.
export const createCachedReader = (readFile: LibraryFileReader): LibraryFileReader => {
  const texts = new Map<string, Promise<string | null>>()
  return (name) => {
    const key = name.replace(/\\/g, '/').toLowerCase()
    const existing = texts.get(key)
    if (existing !== undefined) return existing
    const text = readFile(name)
    texts.set(key, text)
    return text
  }
}

// Each part's shape is read from the library once.
export const createPartShapes = (
  readFile: LibraryFileReader = createCachedReader(readLibraryFile)
): PartShapes => {
  const pending = new Map<string, Promise<PartShape>>()
  const loaded = new Map<string, PartShape>()
  const load = (partName: string): Promise<PartShape> => {
    const key = partName.toLowerCase()
    const existing = pending.get(key)
    if (existing !== undefined) return existing
    const promise = findPartShape(partName, readFile)
      .catch((): PartShape => EMPTY_SHAPE)
      .then((shape) => {
        loaded.set(key, shape)
        return shape
      })
    pending.set(key, promise)
    return promise
  }
  return { load, getLoaded: (partName) => loaded.get(partName.toLowerCase()) }
}
