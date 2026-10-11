import { createRandomTable } from '../../../random-table/index.ts'
import type { BodyPartCatalog } from '../../types/figure-builder.types.ts'
import {
  createDriverSession,
  getDriverChoice,
  getDriverSessionPartBytes,
  mixDriver,
  moveDriverChooser,
} from './driver-session.ts'

const getEntries = (requirements: readonly number[]) =>
  requirements.map((value, index) => ({ name: `part${String(index)}`, value }))

const catalog = {
  hats: getEntries([0, 5, 1, 9]),
  hatMeshNames: ['a', 'b', 'c', 'd'],
  heads: { meshNames: ['heads'], entries: getEntries([0, 0, 7]) },
  torsos: {
    meshNames: ['chests'],
    entries: [0, 3, 0].map((value, index) => ({ name: `t${String(index)}`, type: 0, value })),
  },
  legs: {
    meshNames: ['legss'],
    entries: [0, 0].map((value, index) => ({ name: `l${String(index)}`, type: 0, value })),
  },
} as unknown as BodyPartCatalog

const freeOnly = (requirement: number) => requirement < 3
const table = createRandomTable(Array.from({ length: 1024 }, (_, index) => index))

describe('driver session (0x0047ce30 and 0x00483c60)', () => {
  it('offers the parts the player may use, and always the one he has', () => {
    // Arrange / Act
    const session = createDriverSession(catalog, [3, 2, 1, 0, 4], freeOnly)

    // Assert
    expect(session.hat.indices).toEqual([0, 2, 3])
    expect(session.face.indices).toEqual([0, 1, 2])
    expect(session.torso.indices).toEqual([0, 1, 2])
    expect(session.legs.indices).toEqual([0, 1])
    expect(getDriverSessionPartBytes(session)).toEqual([3, 2, 1, 0, 4])
  })

  it('goes round a chooser in both directions', () => {
    // Arrange
    const session = createDriverSession(catalog, [0, 0, 0, 0, 0], freeOnly)

    // Act
    const previous = moveDriverChooser(session, 'hat', -1)
    const next = moveDriverChooser(previous, 'hat', 1)

    // Assert
    expect(getDriverChoice(previous, 'hat')).toBe(2)
    expect(getDriverChoice(next, 'hat')).toBe(0)
  })

  it('mixes with one draw per chooser, hat first, from the shared random position', () => {
    // Arrange
    const session = createDriverSession(catalog, [0, 0, 0, 0, 0], freeOnly)

    // Act
    const mixed = mixDriver(session, table, 10)

    // Assert
    expect(mixed.randomPosition).toBe(14)
    expect(mixed.session.hat.position).toBe(11 % session.hat.indices.length)
    expect(mixed.session.face.position).toBe(12 % session.face.indices.length)
    expect(mixed.session.torso.position).toBe(13 % session.torso.indices.length)
    expect(mixed.session.legs.position).toBe(14 % session.legs.indices.length)
  })
})
