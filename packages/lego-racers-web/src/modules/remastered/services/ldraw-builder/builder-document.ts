import type {
  BuilderDocument,
  BuilderPart,
  BuilderPartLine,
  Vector,
} from './ldraw-builder.types.ts'

const PART_LINE = /^1\s+(\d+)((?:\s+-?[\d.eE+-]+){12})\s+(\S.*?)\s*$/
const LINE_TYPE = /^(\d)\b/
const COMMENT = /^0\s+\/\//
const INHERITED_COLOR = 16
const POSITION_DECIMALS = 3
const ROTATION_DECIMALS = 6
const MATRIX_SIZE = 3
// A quarter turn about LDraw's vertical axis (y points down): seen from above, counterclockwise.
const QUARTER_TURN: readonly number[] = [0, 0, 1, 0, 1, 0, -1, 0, 0]

const getText = (value: number, decimals: number): string => {
  const rounded = Number(value.toFixed(decimals))
  return String(rounded === 0 ? 0 : rounded)
}

const getIsPartFile = (name: string): boolean => name.toLowerCase().endsWith('.dat')

export const parsePartLine = (line: string): BuilderPartLine | null => {
  const match = PART_LINE.exec(line.trim())
  if (match === null) return null
  const numbers = (match[2] ?? '').trim().split(/\s+/).map(Number)
  if (numbers.some((value) => !Number.isFinite(value))) return null
  return Object.freeze({
    colorCode: Number(match[1]),
    position: [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0] as const,
    rotation: Object.freeze(numbers.slice(MATRIX_SIZE)),
    partName: match[3] ?? '',
  })
}

export const formatPartLine = (part: BuilderPartLine): string =>
  [
    '1',
    String(part.colorCode),
    ...part.position.map((value) => getText(value, POSITION_DECIMALS)),
    ...part.rotation.map((value) => getText(value, ROTATION_DECIMALS)),
    part.partName,
  ].join(' ')

// A model file split into what the builder edits (the `.dat` parts) and what it keeps: the leading header lines, the lines that place
// other models (`.ldr`, `.mpd`), comments (each kept with the part that follows it) and every other line.
export const parseBuilderDocument = (text: string): BuilderDocument => {
  const headerLines: string[] = []
  const referenceLines: string[] = []
  const parts: BuilderPart[] = []
  const keptLines: string[] = []
  let pendingComments: string[] = []
  let isInHeader = true
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue
    const type = LINE_TYPE.exec(line)?.[1]
    if (isInHeader && type === '0' && !COMMENT.test(line)) {
      headerLines.push(line)
      continue
    }
    isInHeader = false
    const parsed = type === '1' ? parsePartLine(line) : null
    if (type === '0' && !line.startsWith('0 FILE') && !line.startsWith('0 NOFILE')) {
      pendingComments.push(line)
    } else if (parsed !== null && getIsPartFile(parsed.partName)) {
      parts.push(Object.freeze({ ...parsed, commentLines: Object.freeze(pendingComments) }))
      pendingComments = []
    } else if (parsed !== null) {
      referenceLines.push(...pendingComments, line)
      pendingComments = []
    } else {
      keptLines.push(...pendingComments, line)
      pendingComments = []
    }
  }
  return Object.freeze({
    headerLines: Object.freeze(headerLines),
    referenceLines: Object.freeze(referenceLines),
    parts: Object.freeze(parts),
    keptLines: Object.freeze([...keptLines, ...pendingComments]),
  })
}

export const getDefaultHeaderLines = (title: string, fileName: string): readonly string[] =>
  Object.freeze([
    `0 ${title}`,
    `0 Name: ${fileName}`,
    '0 Author: LEGO Racers car builder',
    '0 !LDRAW_ORG Unofficial_Model',
    '0 BFC CERTIFY CCW',
  ])

export const serializeBuilderDocument = (document: BuilderDocument): string =>
  [
    ...document.headerLines,
    '',
    ...document.referenceLines,
    ...document.parts.flatMap((part) => [...part.commentLines, formatPartLine(part)]),
    ...document.keptLines,
    '',
  ].join('\n')

export const multiplyRotations = (
  first: readonly number[],
  second: readonly number[]
): readonly number[] =>
  Object.freeze(
    Array.from({ length: MATRIX_SIZE * MATRIX_SIZE }, (_unused, index) => {
      const row = Math.floor(index / MATRIX_SIZE)
      const column = index % MATRIX_SIZE
      return [0, 1, 2].reduce(
        (sum, step) =>
          sum + (first[row * MATRIX_SIZE + step] ?? 0) * (second[step * MATRIX_SIZE + column] ?? 0),
        0
      )
    })
  )

export const rotateVector = (rotation: readonly number[], vector: Vector): Vector => {
  const getRow = (row: number) =>
    vector.reduce((sum, value, step) => sum + (rotation[row * MATRIX_SIZE + step] ?? 0) * value, 0)
  return [getRow(0), getRow(1), getRow(2)]
}

export const turnQuarter = (rotation: readonly number[]): readonly number[] =>
  multiplyRotations(QUARTER_TURN, rotation)

// The parts of a model placed by a reference line, in the frame of the file that places it (colour 16 takes the line's colour).
export const placeReferencedParts = (
  referenceLine: string,
  parts: readonly BuilderPart[]
): readonly BuilderPart[] => {
  const reference = parsePartLine(referenceLine)
  if (reference === null) return []
  return Object.freeze(
    parts.map((part) => {
      const turned = rotateVector(reference.rotation, part.position)
      return Object.freeze({
        ...part,
        colorCode: part.colorCode === INHERITED_COLOR ? reference.colorCode : part.colorCode,
        position: [
          turned[0] + reference.position[0],
          turned[1] + reference.position[1],
          turned[2] + reference.position[2],
        ] as const,
        rotation: multiplyRotations(reference.rotation, part.rotation),
      })
    })
  )
}

// The lower-case model name a reference line places (`rrchas0` for `... rrchas0.ldr`).
export const getReferencedModelName = (referenceLine: string): string | null => {
  const name = parsePartLine(referenceLine)?.partName ?? null
  return name === null ? null : name.toLowerCase().replace(/\.(ldr|mpd)$/, '')
}

const getIsCommentLine = (line: string): boolean => line.startsWith('0')

const keepCommentsWithFirstPart = (
  parts: readonly BuilderPart[],
  commentLines: readonly string[]
): readonly BuilderPart[] =>
  parts.map((part, index) =>
    index === 0 && commentLines.length > 0
      ? Object.freeze({
          ...part,
          commentLines: Object.freeze([...commentLines, ...part.commentLines]),
        })
      : part
  )

// The document with the models its reference lines place (a car's chassis recipe) turned into its own parts, first, where the line
// puts them; a comment before such a line stays with the first part. A line whose model is not given stays a reference.
export const inlineReferencedModels = (
  document: BuilderDocument,
  modelParts: ReadonlyMap<string, readonly BuilderPart[]>
): BuilderDocument => {
  const referenceLines: string[] = []
  const inlinedParts: BuilderPart[] = []
  let pendingComments: string[] = []
  for (const line of document.referenceLines) {
    if (getIsCommentLine(line)) {
      pendingComments.push(line)
      continue
    }
    const name = getReferencedModelName(line)
    const parts = name === null ? undefined : modelParts.get(name)
    if (parts === undefined) referenceLines.push(...pendingComments, line)
    else
      inlinedParts.push(
        ...keepCommentsWithFirstPart(placeReferencedParts(line, parts), pendingComments)
      )
    pendingComments = []
  }
  return Object.freeze({
    ...document,
    referenceLines: Object.freeze([...referenceLines, ...pendingComments]),
    parts: Object.freeze([...inlinedParts, ...document.parts]),
  })
}
