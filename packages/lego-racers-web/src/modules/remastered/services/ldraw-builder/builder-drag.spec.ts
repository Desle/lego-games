import { createConnectionLists, getDragMode, startDrag, updateDrag } from './builder-drag.ts'
import { DragMode } from './builder-drag.types.ts'
import type { DragModifiers, DragView } from './builder-drag.types.ts'
import type { PartShape } from '@lego-games/ldraw/building'
import type { BuilderPart, Vector } from './ldraw-builder.types.ts'

const UP: Vector = [0, -1, 0]
const ORIGIN: Vector = [0, 0, 0]
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
// A 2 x 4 brick (3001): eight studs on top at y 0, its bottom 24 down.
const BRICK: PartShape = {
  studs: [-30, -10, 10, 30].flatMap((x) =>
    [-10, 10].map((z) => ({ position: [x, 0, z] as const, direction: UP }))
  ),
  holes: [],
  box: { minimum: [-40, -4, -20], maximum: [40, 24, 20] },
  footprint: { minimum: [-40, 24, -20], maximum: [40, 24, 20] },
  bottom: 24,
  description: 'Brick  2 x  4',
}

// Seen from the front, above and the side, without perspective: a point is on the screen at (x + z / 4, y + z / 4); the camera looks
// along (1, 1, -4).
const VIEW: DragView = {
  getGroundPoint: (position, height) => {
    const z = (position.clientY - height) * 4
    return [position.clientX - z / 4, height, z]
  },
  getRay: (position) => ({
    origin: [position.clientX - 50, position.clientY - 50, 200],
    direction: [1, 1, -4],
  }),
  project: (point) => [point[0] + point[2] / 4, point[1] + point[2] / 4],
  toScreen: (position) => [position.clientX, position.clientY],
  getConnections: createConnectionLists(() => BRICK),
  snapContext: { getShape: () => BRICK, getBox: () => BRICK.box, groundHeight: 0 },
}

const createBrick = (position: Vector): BuilderPart => ({
  colorCode: 4,
  partName: '3001.dat',
  position,
  rotation: IDENTITY,
  commentLines: [],
})

// A drag of the second part, grabbed at its origin.
const drag = (
  parts: readonly BuilderPart[],
  to: readonly [number, number],
  modifiers: DragModifiers
) => {
  const grabbed = parts[1]?.position ?? ORIGIN
  const from = { clientX: grabbed[0] + grabbed[2] / 4, clientY: grabbed[1] + grabbed[2] / 4 }
  const position = { clientX: to[0], clientY: to[1] }
  const state = startDrag(parts, grabbed, from, getDragMode(modifiers), VIEW)
  return updateDrag(state, [1], position, modifiers, VIEW)
}

describe('updateDrag', () => {
  it('puts a dragged brick onto the studs it is brought near, marking them', () => {
    // Arrange
    const parts = [createBrick([0, -24, 0]), createBrick([100, -48, 0])]

    // Act
    const draft = drag(parts, [3.5, -47.5], { isShift: false, isCommand: false })

    // Assert
    expect(draft.state.parts[1]?.position).toEqual([0, -48, 0])
    expect(draft.target).not.toBeNull()
    expect(draft.guide).toBeNull()
  })

  it('holds a drag with ⇧ to the axis it goes most along, on the stud grid', () => {
    // Arrange
    const parts = [createBrick([0, -24, 400]), createBrick([100, -24, 0])]

    // Act
    const draft = drag(parts, [160, -19], { isShift: true, isCommand: false })

    // Assert
    expect(draft.state.parts[1]?.position).toEqual([160, -24, 0])
    expect(draft.state.mode).toBe(DragMode.AXIS)
    expect(draft.guide?.from[2]).toBe(0)
    expect(draft.guide?.to[2]).toBe(0)
  })

  it('moves up with ⌘ by whole plates', () => {
    // Arrange
    const parts = [createBrick([0, -24, 400]), createBrick([100, -24, 0])]

    // Act
    const draft = drag(parts, [100, -45], { isShift: false, isCommand: true })

    // Assert
    expect(draft.state.parts[1]?.position).toEqual([100, -48, 0])
    expect(draft.state.mode).toBe(DragMode.VERTICAL)
    expect(draft.guide?.from[0]).toBe(100)
  })
})
