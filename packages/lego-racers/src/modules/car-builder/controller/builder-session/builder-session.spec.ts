import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { BuilderRefusal } from '../../types/builder-session/builder-session.ts'
import type { BuilderSession } from '../../types/builder-session/builder-session.types.ts'
import { getBuilderCursorAtBrick } from '../builder-cursor/builder-cursor.ts'
import { loadBuilderCatalog } from '../load-builder-catalog/load-builder-catalog.ts'
import {
  loadSavedCars,
  DEFAULT_SAVE_PATH,
  QUICK_BUILD_SAVE_PATH,
} from '../load-saved-cars/load-saved-cars.ts'
import { serializeCarDesign } from '../serialize-car-design/serialize-car-design.ts'
import { loadCarDesign } from '../load-car-design/load-car-design.ts'
import {
  createBuilderSession,
  getBuilderPlacement,
  moveBuilderSession,
  placeBuilderBrick,
  selectBuilderPiece,
  selectBuilderSet,
  undoBuilderBrick,
} from './builder-session.ts'

const isPresent = getIsOriginalJamPresent()

describe.skipIf(!isPresent)('the builder session on the original files', () => {
  const archive = isPresent ? openJamArchive(readOriginalJam()) : null
  const readFile = (path: string): Uint8Array => {
    if (archive === null) throw new Error('The original files are missing')
    return archive.readFile(path)
  }
  const catalog = isPresent ? loadBuilderCatalog(readFile) : null
  const getCatalog = () => {
    if (catalog === null) throw new Error('The original files are missing')
    return catalog
  }

  it('lists the twelve car sets and starts a car on the chassis of the first', () => {
    // Arrange / Act
    const session = createBuilderSession(getCatalog())

    // Assert
    expect(getCatalog().sets).toHaveLength(12)
    expect(session.design.bricks).toHaveLength(1)
    expect(session.design.bricks[0]?.piece.name).toBe('DDCHAS0')
    expect(session.design.bricks[0]).toMatchObject({ x: 0, y: 0, orientation: 0, baseHeight: 0 })
  })

  const getPlaceableSession = (start: BuilderSession): BuilderSession | null => {
    for (let x = 0; x < 10; x += 1) {
      for (let y = 0; y < 6; y += 1) {
        const candidate: BuilderSession = {
          ...start,
          cursor: getBuilderCursorAtBrick(
            start.cursor.piece,
            start.cursor.colorIndex,
            start.cursor.setId,
            x,
            y,
            0
          ),
        }
        if (getBuilderPlacement(candidate).refusal === null) return candidate
      }
    }
    return null
  }

  it('refuses a brick where it rests on nothing it can attach to, and places one that rests on the chassis', () => {
    // Arrange
    const session = createBuilderSession(getCatalog())
    const placeable = getPlaceableSession(session)

    // Act
    const refused = getBuilderPlacement({
      ...session,
      cursor: getBuilderCursorAtBrick(session.cursor.piece, 0, 11, 9, 5, 0),
    })
    const result = placeable === null ? null : placeBuilderBrick(placeable)

    // Assert
    expect(refused.refusal).not.toBeNull()
    expect(placeable).not.toBeNull()
    expect(result?.kind).toBe('placed')
    expect(result?.kind === 'placed' ? result.session.design.bricks : []).toHaveLength(2)
  })

  it('refuses to place the same brick twice in the same spot, and undoes the first', () => {
    // Arrange
    const placeable = getPlaceableSession(createBuilderSession(getCatalog()))
    const first = placeable === null ? null : placeBuilderBrick(placeable)
    const placed = first?.kind === 'placed' ? first.session : null

    // Act
    const placedAgain = placed === null ? null : getBuilderPlacement(placed)
    const undone = placed === null ? null : undoBuilderBrick(getCatalog(), placed)

    // Assert
    expect(placedAgain?.baseHeight).toBeGreaterThan(0)
    expect(undone?.kind === 'placed' ? undone.session.design.bricks : []).toHaveLength(1)
    expect(undone?.kind === 'placed' ? undone.session.cursor.x : -1).toBe(placed?.cursor.x)
  })

  it('will not take the chassis off (0x004787e0)', () => {
    // Arrange
    const session = createBuilderSession(getCatalog())

    // Act
    const result = undoBuilderBrick(getCatalog(), session)

    // Assert
    expect(result).toEqual({ kind: 'refused', refusal: BuilderRefusal.ONLY_CHASSIS })
  })

  it('moves to another set, which starts another car, and through the bricks of a set', () => {
    // Arrange
    const session = createBuilderSession(getCatalog())

    // Act
    const nextSet = selectBuilderSet(getCatalog(), session, 1)
    const nextPiece = selectBuilderPiece(getCatalog(), session, 1)
    const previousPiece = selectBuilderPiece(getCatalog(), session, -1)

    // Assert
    expect(nextSet.setIndex).toBe(1)
    expect(nextSet.design.bricks[0]?.piece.name).toBe('DBCHAS0')
    expect(nextPiece.pieceIndex).toBe(1)
    expect(previousPiece.pieceIndex).toBe((getCatalog().sets[0]?.bricks.length ?? 1) - 1)
  })

  it('places every brick of the original designs, one by one, as the builder would', () => {
    // Arrange
    const cars = [
      ...loadSavedCars(readFile, DEFAULT_SAVE_PATH),
      ...loadSavedCars(readFile, QUICK_BUILD_SAVE_PATH),
    ]

    // Act
    const replayed = cars.map((car) => {
      const bricks = car.design?.bricks ?? []
      const setIndex = Math.max(
        0,
        getCatalog().sets.findIndex(
          (set) => set.chassisName.toLowerCase() === car.record.chassisName.toLowerCase()
        )
      )
      let session: BuilderSession = createBuilderSession(getCatalog(), setIndex)
      let isEveryBrickPlaced = true
      for (const brick of bricks.slice(1)) {
        session = {
          ...session,
          cursor: getBuilderCursorAtBrick(
            brick.piece,
            brick.colorIndex,
            brick.unidentifiedValue,
            brick.x,
            brick.y,
            brick.orientation
          ),
        }
        const result = placeBuilderBrick(session)
        if (result.kind !== 'placed') isEveryBrickPlaced = false
        else session = result.session
      }
      return { isEveryBrickPlaced, count: session.design.bricks.length, expected: bricks.length }
    })

    // Assert
    expect(replayed.every((entry) => entry.isEveryBrickPlaced)).toBe(true)
    expect(replayed.every((entry) => entry.count === entry.expected)).toBe(true)
  })

  it('writes a design the loader reads back as the same bricks', () => {
    // Arrange
    const cars = loadSavedCars(readFile, DEFAULT_SAVE_PATH)
    const design = cars[0]?.design ?? null

    // Act
    const reloaded =
      design === null ? null : loadCarDesign(serializeCarDesign(design), getCatalog().database)

    // Assert
    expect(
      reloaded?.bricks.map((brick) => [brick.piece.id, brick.x, brick.y, brick.colorIndex])
    ).toEqual(design?.bricks.map((brick) => [brick.piece.id, brick.x, brick.y, brick.colorIndex]))
  })

  it('keeps the cursor inside the grid when it is moved', () => {
    // Arrange
    const session = createBuilderSession(getCatalog())

    // Act
    const moved = moveBuilderSession(session, 20, 20, false)

    // Assert
    expect(moved.session.cursor.x + 1).toBeLessThanOrEqual(10)
  })
})
