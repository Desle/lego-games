import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { turnQuarter } from './builder-document.ts'
import {
  getGridPoint,
  getPartBottom,
  getPartPhase,
  getPlacedBox,
  getPlacedStuds,
  getPlacementPosition,
  getRotatedBox,
  getTopGridPoint,
} from './builder-placement.ts'
import { getBuilderKeyCommand } from './builder-shortcuts.ts'
import { applySelectionEdit, getSelectionEdit } from './builder-snapping.ts'
import type { SnapContext } from './builder-snapping.types.ts'
import { createCachedReader, findPartShape } from './builder-studs.ts'
import type { PartShape } from './builder-studs.types.ts'
import { COMMON_PART_GROUPS } from './common-parts.ts'
import type { BuilderPart, BuilderPartLine, Vector } from './ldraw-builder.types.ts'

const libraryRoot = process.env['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const ROTATIONS = [0, 1, 2, 3].map((count) =>
  Array.from({ length: count }).reduce<readonly number[]>(turnQuarter, IDENTITY)
)
const PALETTE_PART_NAMES = [...new Set(COMMON_PART_GROUPS.flatMap((group) => group.partNames))].map(
  (name) => `${name}.dat`
)
const EXACT = 0.001
// Every palette part through every case: seconds on a fast machine, more on a CI runner.
const PALETTE_TIMEOUT = 120_000
// Spots on the part below's top, from its middle, the cursor lands on.
const CURSOR_SPOTS: readonly (readonly [number, number])[] = [
  [3, 2],
  [-13, 7],
  [27, -6],
  [-34, -4],
]

const readFromDisk = createCachedReader((name) => {
  const path = name.replace(/\\/g, '/').toLowerCase()
  const found = ['parts', 'p']
    .map((folder) => join(libraryRoot, folder, path))
    .find((candidate) => existsSync(candidate))
  return Promise.resolve(found === undefined ? null : readFileSync(found, 'utf8'))
})

const getRemainder = (value: number) => {
  const remainder = ((value % 20) + 20) % 20
  return Math.abs(remainder - 20) < EXACT ? 0 : Number(remainder.toFixed(3)) + 0
}

const getUpwardStuds = (shape: PartShape, part: BuilderPartLine) =>
  getPlacedStuds(shape.studs, part).filter((stud) => stud.direction[1] < -0.99)

const getStudRemainders = (shape: PartShape, part: BuilderPartLine) =>
  new Set(
    getUpwardStuds(shape, part).map(
      (stud) =>
        `${String(getRemainder(stud.position[0]))} ${String(getRemainder(stud.position[2]))}`
    )
  )

// The anti-stud grid a footprint implies, placed: its extent made whole studs, half a stud in; null when it is not whole studs wide.
const getFootprintRemainder = (shape: PartShape, part: BuilderPartLine): string | null => {
  if (shape.footprint === null) return null
  const turned = getRotatedBox(shape.footprint, part.rotation)
  const getAxis = (axis: number) => {
    const start = Math.round((turned.minimum[axis] ?? 0) / 10) * 10
    const width = Math.round((turned.maximum[axis] ?? 0) / 10) * 10 - start
    return width >= 20 && width % 20 === 0
      ? getRemainder(start + 10 + (part.position[axis] ?? 0))
      : null
  }
  const x = getAxis(0)
  const z = getAxis(2)
  return x === null || z === null ? null : `${String(x)} ${String(z)}`
}

// A footprint stands for the anti-studs only when every upward stud is over it (not a round boat bottom, a wheel holder's half).
const getIsFootprintOverStuds = (shape: PartShape): boolean => {
  const footprint = shape.footprint
  if (footprint === null) return false
  const getIsInside = (value: number, axis: number) =>
    value > (footprint.minimum[axis] ?? 0) && value < (footprint.maximum[axis] ?? 0)
  return shape.studs
    .filter((stud) => stud.direction[1] < -0.99)
    .every((stud) => getIsInside(stud.position[0], 0) && getIsInside(stud.position[2], 2))
}

const createLine = (partName: string, position: Vector, rotation: readonly number[]) =>
  Object.freeze({ colorCode: 4, position, rotation, partName })

// Puts a part on the top of a placed part (its body's top at the cursor spot) the way the builder does.
const placeOnTop = (
  shape: PartShape,
  partName: string,
  rotation: readonly number[],
  below: BuilderPartLine,
  belowShape: PartShape,
  point: Vector
): BuilderPartLine | null => {
  if (shape.box === null || belowShape.box === null) return null
  const phase = getPartPhase(getTopGridPoint(belowShape.studs, belowShape.box, below, point), below)
  const position = getPlacementPosition(
    { point, normal: [0, -1, 0], phase },
    getRotatedBox(shape.box, rotation),
    getGridPoint(shape, shape.box, rotation),
    getPartBottom(shape, shape.box, rotation)
  )
  return createLine(partName, position, rotation)
}

// What is wrong with a part resting on the studs of the part below at the given stud: its anti-studs (its footprint's grid) and its
// own studs (a jumper's by their offset from its footprint) off the studs, its bottom off their base.
const getProblems = (
  shape: PartShape,
  placed: BuilderPartLine,
  studRemainder: string,
  studBase: number
): readonly string[] => {
  const problems: string[] = []
  const footprint = getIsFootprintOverStuds(shape) ? getFootprintRemainder(shape, placed) : null
  if (footprint !== null && footprint !== studRemainder) {
    problems.push(`footprint ${footprint} off ${studRemainder}`)
  }
  const ownFootprint = getFootprintRemainder(shape, { ...placed, position: [0, 0, 0] })
  const ownStuds = getStudRemainders(shape, { ...placed, position: [0, 0, 0] })
  const isJumper = ownFootprint !== null && ownStuds.size > 0 && !ownStuds.has(ownFootprint)
  const studs = getStudRemainders(shape, placed)
  if (!isJumper && studs.size > 0 && ![...studs].every((stud) => stud === studRemainder)) {
    problems.push(`studs ${[...studs].join(',')} off ${studRemainder}`)
  }
  const lowest = placed.position[1] + (shape.box?.maximum[1] ?? 0)
  const bottom = placed.position[1] + (shape.bottom ?? shape.box?.maximum[1] ?? 0)
  if (Math.abs(bottom - studBase) > EXACT) {
    problems.push(`bottom ${String(bottom)} not on ${String(studBase)}`)
  }
  if (lowest < studBase - EXACT)
    problems.push(`lowest point ${String(lowest)} above ${String(studBase)}`)
  return problems
}

describe.skipIf(!existsSync(join(libraryRoot, 'parts')))('stud alignment of the palette', () => {
  const loadShape = (partName: string) => findPartShape(partName, readFromDisk)

  it(
    'stands every palette part, turned every way, with its anti-studs on the studs of a 3001 and a 3034 and flush on them',
    async () => {
      // Arrange
      const belowLines = [
        createLine('3001.dat', [10, -24, 0], IDENTITY),
        createLine('3034.dat', [0, -8, 10], turnQuarter(IDENTITY)),
      ]
      const belowShapes = await Promise.all(belowLines.map((line) => loadShape(line.partName)))
      const shapes = await Promise.all(PALETTE_PART_NAMES.map(loadShape))

      // Act
      const failures = PALETTE_PART_NAMES.flatMap((partName, partIndex) => {
        const shape = shapes[partIndex]
        if (shape === undefined || shape.box === null) return [`${partName}: no geometry`]
        return belowLines.flatMap((below, belowIndex) => {
          const belowShape = belowShapes[belowIndex]
          if (belowShape === undefined) return []
          const studBase = below.position[1]
          return ROTATIONS.flatMap((rotation, turnCount) =>
            CURSOR_SPOTS.flatMap(([x, z]) => {
              const point: Vector = [below.position[0] + x, studBase - 4, below.position[2] + z]
              const placed = placeOnTop(shape, partName, rotation, below, belowShape, point)
              const nearest = getTopGridPoint(
                belowShape.studs,
                belowShape.box ?? { minimum: [0, 0, 0], maximum: [0, 0, 0] },
                below,
                point
              )
              const studRemainder = `${String(getRemainder(below.position[0] + nearest[0]))} ${String(getRemainder(below.position[2] + nearest[2]))}`
              const problems =
                placed === null
                  ? ['not placed']
                  : getProblems(shape, placed, studRemainder, studBase)
              return problems.map(
                (problem) =>
                  `${partName} on ${below.partName} turned ${String(turnCount)} at ${String(x)},${String(z)}: ${problem}`
              )
            })
          )
        })
      })
      if (failures.length > 0) console.log(failures.join('\n'))

      // Assert
      expect(failures).toEqual([])
    },
    PALETTE_TIMEOUT
  )

  it(
    'stands a 3001, turned or not, on every stud of every palette part with its anti-studs on that stud and flush on its base',
    async () => {
      // Arrange
      const brick = await loadShape('3001.dat')
      const shapes = await Promise.all(PALETTE_PART_NAMES.map(loadShape))

      // Act
      const failures = PALETTE_PART_NAMES.flatMap((partName, partIndex) => {
        const shape = shapes[partIndex]
        if (shape === undefined || shape.box === null) return []
        return ROTATIONS.flatMap((rotation, turnCount) => {
          const part = createLine(partName, [10, -40, 0], rotation)
          return getUpwardStuds(shape, part).flatMap((stud) =>
            [IDENTITY, turnQuarter(IDENTITY)].flatMap((brickRotation, brickTurn) => {
              const point: Vector = [
                stud.position[0] + 2,
                stud.position[1] - 4,
                stud.position[2] - 3,
              ]
              const placed = placeOnTop(brick, '3001.dat', brickRotation, part, shape, point)
              const studRemainder = `${String(getRemainder(stud.position[0]))} ${String(getRemainder(stud.position[2]))}`
              const problems =
                placed === null
                  ? ['not placed']
                  : getProblems(brick, placed, studRemainder, stud.position[1])
              return problems.map(
                (problem) =>
                  `3001 turned ${String(brickTurn)} on ${partName} turned ${String(turnCount)} stud ${stud.position.map((value) => value.toFixed(1)).join(',')}: ${problem}`
              )
            })
          )
        })
      })
      if (failures.length > 0) console.log(failures.join('\n'))

      // Assert
      expect(failures).toEqual([])
    },
    PALETTE_TIMEOUT
  )
})

// Keys pressed on a part resting on the base (`+` then c for command, s for shift, o for option) and what must hold after them:
// resting on the studs under it, on their plate grid (lifted, lowered), tilted flush on them, or back where it was (turns undone). A fine nudge is off the grid on
// purpose; the plain move after it snaps back.
const KEY_COMBINATIONS: readonly { readonly keys: readonly string[]; readonly check: string }[] = [
  { keys: ['ArrowRight'], check: 'rest' },
  { keys: ['ArrowLeft'], check: 'rest' },
  { keys: ['ArrowUp'], check: 'rest' },
  { keys: ['ArrowDown'], check: 'rest' },
  { keys: ['ArrowRight', 'ArrowRight', 'ArrowUp'], check: 'rest' },
  { keys: ['ArrowUp+c'], check: 'lift' },
  { keys: ['ArrowDown+c'], check: 'lift' },
  { keys: ['ArrowUp+cs'], check: 'lift' },
  { keys: ['ArrowDown+cs'], check: 'lift' },
  { keys: ['ArrowUp+c', 'ArrowRight'], check: 'lift' },
  { keys: ['ArrowUp+c', 'ArrowLeft', 'ArrowDown+c'], check: 'rest' },
  { keys: ['ArrowRight+o', 'ArrowLeft'], check: 'rest' },
  { keys: ['ArrowLeft+o', 'ArrowRight'], check: 'rest' },
  { keys: ['ArrowUp+o', 'ArrowDown'], check: 'rest' },
  { keys: ['ArrowDown+o', 'ArrowUp'], check: 'rest' },
  { keys: ['ArrowUp+co', 'ArrowRight'], check: 'rest' },
  { keys: ['r'], check: 'rest' },
  { keys: ['r+s'], check: 'rest' },
  { keys: ['r', 'r'], check: 'rest' },
  { keys: ['t'], check: 'tilt' },
  { keys: ['t+s'], check: 'tilt' },
  { keys: ['t', 't+s'], check: 'rest' },
  { keys: ['r', 'r+s'], check: 'same' },
  { keys: ['r', 'r', 'r', 'r'], check: 'same' },
  { keys: ['r', 'r', 'r+s', 'r+s'], check: 'same' },
]

const getKeyPress = (text: string) => {
  const [key = '', modifiers = ''] = text.split('+')
  return {
    key,
    isCommand: modifiers.includes('c'),
    isShift: modifiers.includes('s'),
    isOption: modifiers.includes('o'),
  }
}

// The camera orbited a quarter turn at a time.
const VIEWS = [0, 1, 2, 3].map((quarter) =>
  Object.freeze({
    target: [0, 0, 0] as const,
    azimuth: (quarter * Math.PI) / 2 + 0.3,
    elevation: 0.5,
    distance: 10,
  })
)

describe.skipIf(!existsSync(join(libraryRoot, 'parts')))('stud alignment of keyboard edits', () => {
  const loadShape = (partName: string) => findPartShape(partName, readFromDisk)
  const base = Object.freeze({ ...createLine('3958.dat', [10, -8, 0], IDENTITY), commentLines: [] })
  const getContext = (shapes: ReadonlyMap<string, PartShape>): SnapContext => ({
    getShape: (partName) => shapes.get(partName),
    getBox: (part) => shapes.get(part.partName)?.box ?? null,
    groundHeight: 0,
  })

  // What is wrong with a part after a key: on the base when its box is over it, else on the ground (studs at 10, top at 0).
  const getKeyProblems = (
    shapes: ReadonlyMap<string, PartShape>,
    part: BuilderPart,
    check: string
  ): readonly string[] => {
    const shape = shapes.get(part.partName)
    const baseShape = shapes.get(base.partName)
    if (shape?.box == null || baseShape?.box == null || check === 'none') return []
    const box = getPlacedBox(shape.box, part)
    const baseBox = getPlacedBox(baseShape.box, base)
    const isOverBase =
      [0, 2].every(
        (axis) =>
          (box.minimum[axis] ?? 0) < (baseBox.maximum[axis] ?? 0) - 0.5 &&
          (box.maximum[axis] ?? 0) > (baseBox.minimum[axis] ?? 0) + 0.5
      ) && baseBox.minimum[1] >= box.minimum[1] - EXACT
    const [baseStud] = [...getStudRemainders(baseShape, base)]
    const studRemainder = isOverBase ? (baseStud ?? '') : '10 10'
    const top = isOverBase ? base.position[1] : 0
    if (check === 'tilt') {
      return Math.abs(box.maximum[1] - top) > EXACT
        ? [`tilted bottom ${String(box.maximum[1])} not on ${String(top)}`]
        : []
    }
    const problems = getProblems(shape, part, studRemainder, top)
    if (check === 'rest') return problems
    const bottom = part.position[1] + (shape.bottom ?? shape.box.maximum[1])
    return [
      ...problems.filter(
        (problem) => !problem.startsWith('bottom') && !problem.startsWith('lowest')
      ),
      ...(getRemainder((bottom - top) * 2.5) === 0
        ? []
        : [`lifted bottom ${String(bottom)} off the plates`]),
    ]
  }

  it(
    'keeps every palette part, turned every way, on the studs and flush after every key, the camera orbited every way',
    async () => {
      // Arrange
      const names = ['3958.dat', ...PALETTE_PART_NAMES]
      const shapes = new Map(
        await Promise.all(names.map(async (name) => [name, await loadShape(name)] as const))
      )
      const context = getContext(shapes)
      const baseShape = shapes.get(base.partName)

      // Act
      const failures = PALETTE_PART_NAMES.flatMap((partName) => {
        const shape = shapes.get(partName)
        if (shape === undefined || baseShape === undefined) return []
        return ROTATIONS.flatMap((rotation, turnCount) => {
          const placed = placeOnTop(shape, partName, rotation, base, baseShape, [13, -12, 2])
          if (placed === null) return []
          return VIEWS.flatMap((view, viewIndex) => {
            const start: readonly BuilderPart[] = [base, { ...placed, commentLines: [] }]
            return KEY_COMBINATIONS.flatMap((combination) => {
              const parts = combination.keys.reduce((current, text) => {
                const command = getBuilderKeyCommand(getKeyPress(text))
                const edit = command === null ? null : getSelectionEdit(command.action, view)
                return edit === null ? current : applySelectionEdit(current, [1], edit, context)
              }, start)
              const part = parts[1]
              const isBack =
                part !== undefined &&
                part.position.every((value, axis) => value === placed.position[axis]) &&
                part.rotation.every((value, entry) => value === placed.rotation[entry])
              const problems =
                part === undefined
                  ? ['lost']
                  : combination.check === 'same'
                    ? isBack
                      ? []
                      : [`not back where it was: ${part.position.join(' ')}`]
                    : getKeyProblems(shapes, part, combination.check)
              return problems.map(
                (problem) =>
                  `${partName} turned ${String(turnCount)} view ${String(viewIndex)} keys ${combination.keys.join(' ')}: ${problem}`
              )
            })
          })
        })
      })
      if (failures.length > 0) console.log(failures.join('\n'))

      // Assert
      expect(failures).toEqual([])
    },
    PALETTE_TIMEOUT
  )

  it('moves a selection of a brick and a plate on it as one, by the brick, keeping their offsets', async () => {
    // Arrange
    const shapes = new Map(
      await Promise.all(
        ['3958.dat', '3001.dat', '3023b.dat'].map(
          async (name) => [name, await loadShape(name)] as const
        )
      )
    )
    const parts: readonly BuilderPart[] = [
      base,
      { ...createLine('3001.dat', [30, -32, 10], IDENTITY), commentLines: [] },
      { ...createLine('3023b.dat', [20, -40, 10], IDENTITY), commentLines: [] },
    ]
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'r', 'r+s']

    // Act
    const moved = VIEWS.flatMap((view) =>
      keys.map((text) => {
        const command = getBuilderKeyCommand(getKeyPress(text))
        const edit = command === null ? null : getSelectionEdit(command.action, view)
        return edit === null ? parts : applySelectionEdit(parts, [1, 2], edit, getContext(shapes))
      })
    )
    const problems = moved.flatMap(([, brick]) =>
      brick === undefined ? ['lost'] : getKeyProblems(shapes, brick, 'rest')
    )
    // A turn turns the offsets too; a move keeps them.
    const offsets = new Set(
      moved.flatMap(([, brick, plate], index) =>
        brick === undefined || plate === undefined || keys[index % keys.length]?.startsWith('r')
          ? []
          : [plate.position.map((value, axis) => value - (brick.position[axis] ?? 0)).join(' ')]
      )
    )

    // Assert
    expect(moved.length).toBeGreaterThan(0)
    expect(problems).toEqual([])
    expect(offsets).toEqual(new Set(['-10 -8 0']))
  })
})
