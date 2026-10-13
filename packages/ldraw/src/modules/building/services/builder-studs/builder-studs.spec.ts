import { findModelFacePoints, findPartShape } from './builder-studs.ts'

// The stud lines of 87087 (Brick 1 x 1 with Stud on 1 Side): one on top, one on the side facing -z, a tube underneath, a subpart.
const FILES: Readonly<Record<string, string>> = {
  'side.dat': [
    '0 Brick  1 x  1 with Stud on 1 Side',
    '1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat',
    '1 16 0 10 -10 1 0 0 0 0 1 0 1 0 stud2a.dat',
    '1 16 0 4 0 1 0 0 0 -5 0 0 0 1 stud4.dat',
    '1 16 0 24 0 -6 0 0 0 -20 0 0 0 6 box4t.dat',
    '1 16 20 0 0 0 0 1 0 1 0 -1 0 0 s\\side-s01.dat',
  ].join('\n'),
  's\\side-s01.dat': '1 16 0 0 10 1 0 0 0 1 0 0 0 1 stud-logo4.dat',
}

const readFile = (name: string) => Promise.resolve(FILES[name] ?? null)
const round = (values: readonly number[]) => values.map((value) => Number(value.toFixed(6)) + 0)

describe('findPartShape', () => {
  it('finds the studs of a part and its subparts, each pointing the way its matrix turns it', async () => {
    // Arrange
    const partName = 'side.dat'

    // Act
    const { studs } = await findPartShape(partName, readFile)

    // Assert
    expect(
      studs.map((stud) => ({ position: round(stud.position), direction: round(stud.direction) }))
    ).toEqual([
      { position: [0, 0, 0], direction: [0, -1, 0] },
      { position: [0, 10, -10], direction: [0, 0, -1] },
      { position: [30, 0, 0], direction: [0, -1, 0] },
    ])
  })

  it('finds nothing for a part the library lacks', async () => {
    // Arrange
    const partName = 'missing.dat'

    // Act
    const { studs } = await findPartShape(partName, readFile)

    // Assert
    expect(studs).toEqual([])
  })
})

describe('findModelFacePoints', () => {
  it('places the faces of the parts a model places, with the faces of the model itself', async () => {
    // Arrange
    const text = ['1 4 100 0 0 1 0 0 0 1 0 0 0 1 corner.dat', '3 4 0 0 0 1 0 0 0 0 1'].join('\n')
    const files: Readonly<Record<string, string>> = { 'corner.dat': '3 16 0 -4 0 6 -4 0 0 -4 6' }

    // Act
    const points = await findModelFacePoints(text, (name) => Promise.resolve(files[name] ?? null))

    // Assert
    expect(points.map((point) => [...point])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [100, -4, 0],
      [106, -4, 0],
      [100, -4, 6],
    ])
  })
})
