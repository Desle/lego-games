import { rotateVector, turnQuarter } from './builder-document.ts'
import { PLATE_HEIGHT, STUD_WIDTH } from './builder-placement.ts'
import { getQuarterTurnAbout, turnAbout } from './builder-rotation.ts'
import type { AddedParts } from './builder-editing.types.ts'
import type { BuilderPart, Vector } from './ldraw-builder.types.ts'

const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const QUARTER_TURN = turnQuarter(IDENTITY_ROTATION)
const HALF_STUD = STUD_WIDTH / 2
const HALF_PLATE = PLATE_HEIGHT / 2
const TURNS_BACK = 3

const addVectors = (first: Vector, second: Vector): Vector => [
  first[0] + second[0],
  first[1] + second[1],
  first[2] + second[2],
]

export const moveParts = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  offset: Vector
): readonly BuilderPart[] =>
  parts.map((part, index) =>
    indices.includes(index)
      ? Object.freeze({ ...part, position: addVectors(part.position, offset) })
      : part
  )

// A quarter turn (three of them the other way) of the chosen parts about the vertical through their middle, kept on the stud grid.
export const turnParts = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  isBack: boolean
): readonly BuilderPart[] => {
  const chosen = parts.filter((_part, index) => indices.includes(index))
  if (chosen.length === 0) return parts
  const getMiddle = (axis: number) =>
    HALF_STUD *
    Math.round(
      chosen.reduce((sum, part) => sum + (part.position[axis] ?? 0), 0) / chosen.length / HALF_STUD
    )
  const pivot: Vector = [getMiddle(0), 0, getMiddle(2)]
  const turnCount = isBack ? TURNS_BACK : 1
  const turnOnce = (part: BuilderPart): BuilderPart => {
    const fromPivot: Vector = [part.position[0] - pivot[0], 0, part.position[2] - pivot[2]]
    const turned = rotateVector(QUARTER_TURN, fromPivot)
    return Object.freeze({
      ...part,
      rotation: turnQuarter(part.rotation),
      position: [turned[0] + pivot[0], part.position[1], turned[2] + pivot[2]] as const,
    })
  }
  return parts.map((part, index) =>
    indices.includes(index)
      ? Array.from({ length: turnCount }).reduce<BuilderPart>(turnOnce, part)
      : part
  )
}

// A quarter turn of the chosen parts about a level LDraw axis: one part about its own origin, several about their middle (on the
// half-stud and half-plate grid). Every turn stays made of ±1 and 0.
export const tiltParts = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  axis: Vector
): readonly BuilderPart[] => {
  const chosen = parts.filter((_part, index) => indices.includes(index))
  const [first] = chosen
  if (first === undefined) return parts
  const getMiddle = (axisIndex: number, step: number) =>
    step *
    Math.round(
      chosen.reduce((sum, part) => sum + (part.position[axisIndex] ?? 0), 0) / chosen.length / step
    )
  const pivot: Vector =
    chosen.length === 1
      ? first.position
      : [getMiddle(0, HALF_STUD), getMiddle(1, HALF_PLATE), getMiddle(2, HALF_STUD)]
  const quarter = getQuarterTurnAbout(axis)
  return parts.map((part, index) => {
    if (!indices.includes(index)) return part
    const turned = rotateVector(quarter, [
      part.position[0] - pivot[0],
      part.position[1] - pivot[1],
      part.position[2] - pivot[2],
    ])
    return Object.freeze({
      ...part,
      rotation: turnAbout(part.rotation, axis),
      position: [
        Number((turned[0] + pivot[0]).toFixed(3)) + 0,
        Number((turned[1] + pivot[1]).toFixed(3)) + 0,
        Number((turned[2] + pivot[2]).toFixed(3)) + 0,
      ] as const,
    })
  })
}

export const removeParts = (
  parts: readonly BuilderPart[],
  indices: readonly number[]
): readonly BuilderPart[] => parts.filter((_part, index) => !indices.includes(index))

export const pickParts = (
  parts: readonly BuilderPart[],
  indices: readonly number[]
): readonly BuilderPart[] => parts.filter((_part, index) => indices.includes(index))

// Copies moved by the offset at the end of the model, with where they went so they can be selected.
export const addParts = (
  parts: readonly BuilderPart[],
  added: readonly BuilderPart[],
  offset: Vector
): AddedParts =>
  Object.freeze({
    parts: Object.freeze([
      ...parts,
      ...added.map((part) =>
        Object.freeze({ ...part, position: addVectors(part.position, offset) })
      ),
    ]),
    indices: Object.freeze(added.map((_part, step) => parts.length + step)),
  })

export const toggleIndex = (indices: readonly number[], index: number): readonly number[] =>
  indices.includes(index) ? indices.filter((value) => value !== index) : [...indices, index]

// A stud along whichever of the editing frame's ground axes (x or z) is nearest to a direction.
export const getStudStep = (direction: Vector): Vector =>
  Math.abs(direction[0]) >= Math.abs(direction[2])
    ? [Math.sign(direction[0]) * STUD_WIDTH, 0, 0]
    : [0, 0, Math.sign(direction[2]) * STUD_WIDTH]

// A drag across the ground in whole studs.
export const getStudOffset = (from: Vector, to: Vector): Vector => [
  STUD_WIDTH * Math.round((to[0] - from[0]) / STUD_WIDTH),
  0,
  STUD_WIDTH * Math.round((to[2] - from[2]) / STUD_WIDTH),
]
