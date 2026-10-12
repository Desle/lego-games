import { countLDrawColors } from './ldraw-color-names.ts'
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
