import { decodeWindowsBitmap } from './windows-bitmap.ts'

const getHeaders = (width: number, height: number, bitsPerPixel: number, paletteBytes: number) => {
  const headers = Buffer.alloc(54)
  headers.write('BM', 0, 'latin1')
  headers.writeUInt32LE(54 + paletteBytes, 10)
  headers.writeUInt32LE(40, 14)
  headers.writeInt32LE(width, 18)
  headers.writeInt32LE(height, 22)
  headers.writeUInt16LE(1, 26)
  headers.writeUInt16LE(bitsPerPixel, 28)
  return headers
}

describe('decodeWindowsBitmap', () => {
  it('reads a 24-bit bottom-up picture top row first, with rows padded to four bytes', () => {
    // Arrange
    const pixels = Buffer.from([
      // bottom row: blue, white, padding
      255, 0, 0, 255, 255, 255, 0, 0,
      // top row: red, green, padding
      0, 0, 255, 0, 255, 0, 0, 0,
    ])
    const file = Buffer.concat([getHeaders(2, 2, 24, 0), pixels])

    // Act
    const image = decodeWindowsBitmap(file)

    // Assert
    expect([image.width, image.height]).toEqual([2, 2])
    expect([...image.colors]).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ])
  })

  it('reads an 8-bit picture through its palette', () => {
    // Arrange
    const palette = Buffer.from([0, 0, 255, 0, 255, 0, 0, 0])
    const file = Buffer.concat([getHeaders(2, 1, 8, 8), palette, Buffer.from([1, 0, 0, 0])])
    file.writeUInt32LE(2, 46)

    // Act
    const image = decodeWindowsBitmap(file)

    // Assert
    expect([...image.colors]).toEqual([0, 0, 255, 255, 255, 0, 0, 255])
  })

  it('rejects a file that is not a bitmap', () => {
    // Arrange
    const file = new Uint8Array(64)

    // Act
    const decode = () => decodeWindowsBitmap(file)

    // Assert
    expect(decode).toThrow('Not a Windows bitmap')
  })
})
