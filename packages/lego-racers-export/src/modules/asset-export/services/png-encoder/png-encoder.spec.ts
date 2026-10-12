import { inflateSync } from 'node:zlib'
import { encodePng } from './png-encoder.ts'

describe('encodePng', () => {
  it('writes the PNG signature, the size and every pixel of a 2x1 picture', () => {
    // Arrange
    const colors = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 128])

    // Act
    const png = Buffer.from(encodePng({ width: 2, height: 1, colors }))

    // Assert
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(png.readUInt32BE(16)).toBe(2)
    expect(png.readUInt32BE(20)).toBe(1)
    const dataLength = png.readUInt32BE(33)
    const decoded = inflateSync(png.subarray(41, 41 + dataLength))
    expect([...decoded]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 128])
  })
})
