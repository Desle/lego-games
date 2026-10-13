import { BuilderAction } from './builder-shortcuts.types.ts'
import {
  applySelectionEdit,
  getCameraStudStep,
  getSelectionEdit,
  snapSelection,
} from './builder-snapping.ts'
import type { SnapContext } from './builder-snapping.types.ts'
import type { PartShape } from './builder-studs.types.ts'
import type { BuilderPart, Vector } from './ldraw-builder.types.ts'

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const VIEW = { target: [0, 0, 0] as const, azimuth: 0.3, elevation: 0.5, distance: 10 }

const getStuds = (positions: readonly Vector[]) =>
  positions.map((position) => ({ position, direction: [0, -1, 0] as const }))

// A 6 x 6 plate (3958) and a 1 x 2 plate (3023b) as the library gives them.
const SHAPES: ReadonlyMap<string, PartShape> = new Map([
  [
    '3958.dat',
    {
      studs: getStuds(
        [-50, -30, -10, 10, 30, 50].flatMap((x): Vector[] =>
          [-50, -30, -10, 10, 30, 50].map((z): Vector => [x, 0, z])
        )
      ),
      box: { minimum: [-60, -4, -60], maximum: [60, 8, 60] },
      footprint: { minimum: [-60, 8, -60], maximum: [60, 8, 60] },
      bottom: 8,
    },
  ],
  [
    '3023b.dat',
    {
      studs: getStuds([
        [-10, 0, 0],
        [10, 0, 0],
      ]),
      box: { minimum: [-20, -4, -10], maximum: [20, 8, 10] },
      footprint: { minimum: [-20, 8, -10], maximum: [20, 8, 10] },
      bottom: 8,
    },
  ],
])
const CONTEXT: SnapContext = {
  getShape: (partName) => SHAPES.get(partName),
  getBox: (part) => SHAPES.get(part.partName)?.box ?? null,
  groundHeight: 0,
}

const createPart = (partName: string, position: Vector): BuilderPart =>
  Object.freeze({ colorCode: 4, position, rotation: IDENTITY, partName, commentLines: [] })

// A 6 x 6 plate on the ground (its studs at 10 across, its top at -8) and a 1 x 2 plate on it.
const BASE = createPart('3958.dat', [0, -8, 0])
const ON_BASE = createPart('3023b.dat', [20, -16, 10])

const edit = (parts: readonly BuilderPart[], action: BuilderAction, indices = [1]) => {
  const selectionEdit = getSelectionEdit(action, VIEW)
  return selectionEdit === null ? parts : applySelectionEdit(parts, indices, selectionEdit, CONTEXT)
}

describe('applySelectionEdit', () => {
  it('moves a part a stud and keeps it resting on the studs below', () => {
    // Arrange
    const parts = [BASE, ON_BASE]
    const step = getCameraStudStep(VIEW, false, 1)

    // Act
    const moved = edit(parts, BuilderAction.MOVE_RIGHT)

    // Assert
    expect(moved[1]?.position).toEqual([20 + step[0], -16, 10 + step[2]])
  })

  it('leaves a fine nudge off the grid and snaps it back with the next move', () => {
    // Arrange
    const parts = [BASE, ON_BASE]

    // Act
    const nudged = edit(parts, BuilderAction.NUDGE_RIGHT)
    const back = edit(edit(nudged, BuilderAction.MOVE_RIGHT), BuilderAction.MOVE_LEFT)

    // Assert
    expect(nudged[1]?.position).not.toEqual(ON_BASE.position)
    expect(back[1]?.position).toEqual(ON_BASE.position)
  })

  it('lifts a part by a plate and keeps it on that plate level as it moves', () => {
    // Arrange
    const parts = [BASE, ON_BASE]

    // Act
    const lifted = edit(parts, BuilderAction.RAISE_PLATE)
    const moved = edit(lifted, BuilderAction.MOVE_LEFT)
    const lowered = edit(edit(moved, BuilderAction.MOVE_RIGHT), BuilderAction.LOWER_PLATE)

    // Assert
    expect(lifted[1]?.position[1]).toBe(-24)
    expect(moved[1]?.position[1]).toBe(-24)
    expect(lowered[1]?.position).toEqual(ON_BASE.position)
  })

  it('drops a part moved off the plate onto the ground', () => {
    // Arrange
    const parts = [BASE, createPart('3023b.dat', [20, -16, 10])]

    // Act
    const off = snapSelection(
      parts.map((part, index) =>
        index === 1 ? { ...part, position: [20, -16, 70] as const } : part
      ),
      [1],
      CONTEXT,
      true
    )

    // Assert
    expect(off[1]?.position).toEqual([20, -8, 70])
  })

  it('turns a 1 x 2 plate onto the stud grid, resting where it was', () => {
    // Arrange
    const parts = [BASE, ON_BASE]

    // Act
    const turned = edit(parts, BuilderAction.ROTATE)
    const position = turned[1]?.position ?? [0, 0, 0]

    // Assert
    expect(turned[1]?.rotation).not.toEqual(IDENTITY)
    expect(position[1]).toBe(-16)
    expect([((position[0] % 20) + 20) % 20, ((position[2] % 20) + 20) % 20]).toEqual([10, 0])
  })
})
