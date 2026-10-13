import { getMinifigConnections, getPartConnections } from './builder-connections.ts'
import { ConnectionKind } from './builder-connections.types.ts'
import type { PartShape } from '../builder-studs/builder-studs.types.ts'

const UP = [0, -1, 0] as const

const createShape = (overrides: Partial<PartShape>): PartShape => ({
  studs: [],
  holes: [],
  box: null,
  footprint: null,
  bottom: null,
  description: '',
  ...overrides,
})

const getKinds = (partName: string, description: string) =>
  getMinifigConnections(partName, description).map(
    (connection) => `${connection.isMale ? 'male' : 'female'} ${connection.kind}`
  )

describe('getPartConnections', () => {
  it('finds the studs on top and a receptacle in each stud cell of the bottom', () => {
    // Arrange
    const plate = createShape({
      studs: [-10, 10].map((x) => ({ position: [x, 0, 0], direction: UP }) as const),
      footprint: { minimum: [-20, 8, -10], maximum: [20, 8, 10] },
      bottom: 8,
    })

    // Act
    const connections = getPartConnections('3023.dat', plate)

    // Assert
    expect(connections.map((connection) => [connection.isMale, ...connection.position])).toEqual([
      [true, -10, 0, 0],
      [true, 10, 0, 0],
      [false, -10, 8, 0],
      [false, 10, 8, 0],
    ])
    expect(connections.every((connection) => connection.kind === ConnectionKind.STUD)).toBe(true)
  })

  it('leaves the tubes at the bottom of a brick to its stud cells', () => {
    // Arrange
    const brick = createShape({
      holes: [{ position: [0, 24, 0], direction: UP }],
      footprint: { minimum: [-20, 24, -20], maximum: [20, 24, 20] },
    })

    // Act
    const connections = getPartConnections('3003.dat', brick)

    // Assert
    expect(connections.map((connection) => connection.position)).toEqual([
      [-10, 24, -10],
      [-10, 24, 10],
      [10, 24, -10],
      [10, 24, 10],
    ])
  })

  it('takes a hat socket as a receptacle for the stud of a head', () => {
    // Arrange
    const hat = createShape({
      holes: [{ position: [0, 0, 0], direction: UP }],
      description: 'Minifig Police Hat',
    })

    // Act
    const connections = getPartConnections('3624.dat', hat)

    // Assert
    expect(
      connections.map((connection) => `${String(connection.isMale)} ${connection.kind}`)
    ).toEqual(['false stud', 'false hat'])
  })
})

describe('getMinifigConnections', () => {
  it('knows the joints of the figure by part number, prints and older numbers too', () => {
    // Arrange
    const parts = [
      ['3626bp01.dat', 'Minifig Head with Face'],
      ['973p39.dat', 'Minifig Torso with Print'],
      ['3815b.dat', 'Minifig Hips'],
      ['3817b.dat', 'Minifig Leg Left'],
      ['3819.dat', 'Minifig Arm Left'],
      ['3820.dat', 'Minifig Hand'],
    ] as const

    // Act
    const kinds = parts.map(([partName, description]) => getKinds(partName, description))

    // Assert
    expect(kinds).toEqual([
      ['female neck', 'male hat'],
      ['male neck', 'female hip', 'male left_arm', 'male right_arm'],
      ['male hip', 'male leg'],
      ['female leg'],
      ['female left_arm', 'male wrist'],
      ['female wrist', 'male grip'],
    ])
  })

  it('finds headgear and tools by their title, and gives a torso with arms no shoulders', () => {
    // Arrange
    const parts = [
      ['973c01.dat', 'Minifig Torso with Arms and Yellow Hands'],
      ['2544.dat', 'Minifig Hat Tricorne'],
      ['3837.dat', 'Minifig Shovel'],
      ['87693.dat', 'Minifig Plume Small'],
      ['3001.dat', 'Brick  2 x  4'],
    ] as const

    // Act
    const kinds = parts.map(([partName, description]) => getKinds(partName, description))

    // Assert
    expect(kinds).toEqual([['male neck', 'female hip'], ['female hat'], ['female grip'], [], []])
  })
})
