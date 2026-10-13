import { getPaletteGroups } from './builder-palette.ts'

const PARTS = [
  { name: '3001.dat', description: 'Brick  2 x  4' },
  { name: '3039.dat', description: 'Slope Brick 45  2 x  2' },
  { name: '30039.dat', description: 'Tile  1 x  1 with Groove' },
]

describe('getPaletteGroups', () => {
  it('shows the shortlist parts the library has when nothing is typed', () => {
    // Arrange
    const query = ''

    // Act
    const groups = getPaletteGroups(PARTS, query)

    // Assert
    expect(groups.find((group) => group.label === 'Bricks')?.parts).toEqual([PARTS[0]])
  })

  it('finds by number first, then by every word of the description', () => {
    // Arrange
    const queries = ['3003', 'slope 45']

    // Act
    const found = queries.map((query) => getPaletteGroups(PARTS, query)[0]?.parts)

    // Assert
    expect(found).toEqual([[PARTS[2]], [PARTS[1]]])
  })

  it('leads with the parts of the model, the latest placed first', () => {
    // Arrange
    const used = ['3001.dat', '3039.dat', '3001.dat']

    // Act
    const groups = getPaletteGroups(PARTS, '', used)

    // Assert
    expect(groups[0]).toEqual({ label: 'Used', parts: [PARTS[0], PARTS[1]] })
  })
})
