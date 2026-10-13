import {
  countLDrawColors,
  parseBrickColorNames,
  parseBuildableColorNames,
} from './ldraw-color-names.ts'
import type { LDrawColorName } from './reference-kit.types.ts'

const palette: readonly LDrawColorName[] = [
  { code: 0, name: 'Black', red: 0x1b, green: 0x2a, blue: 0x34 },
  { code: 1, name: 'Blue', red: 0x1e, green: 0x5a, blue: 0xa8 },
]

describe('countLDrawColors', () => {
  it('names a dark bluish triangle black, not blue', () => {
    // Arrange
    const faces = { positions: new Float32Array(9), colors: Uint8Array.from([12, 18, 60]) }

    // Act
    const shares = countLDrawColors(faces, palette)

    // Assert
    expect(shares.map(({ name }) => name)).toEqual(['Black'])
  })
})

const configuration = [
  '0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333',
  '0 !COLOUR Trans_Clear CODE 47 VALUE #FCFCFC EDGE #C3C3C3 ALPHA 128',
].join('\n')

describe('parseBrickColorNames', () => {
  it('keeps only the solid colours', () => {
    // Arrange, Act
    const colors = parseBrickColorNames(configuration)

    // Assert
    expect(colors.map(({ code }) => code)).toEqual([4])
  })
})

describe('parseBuildableColorNames', () => {
  it('also offers the see-through colours', () => {
    // Arrange, Act
    const colors = parseBuildableColorNames(configuration)

    // Assert
    expect(colors.map(({ code }) => code)).toEqual([4, 47])
  })
})
