import { readJamTextLine } from './jam-text-line.ts'

const encode = (text: string): Uint8Array =>
  Uint8Array.from({ length: text.length }, (_, index) => text.charCodeAt(index))

describe('readJamTextLine', () => {
  it('strips a CR LF line end and consumes it', () => {
    // Arrange
    const bytes = encode('Sounds\\\r\n29\r\n')

    // Act
    const line = readJamTextLine(bytes, 0, 0x104)

    // Assert
    expect(line).toEqual({ text: 'Sounds\\', consumedByteCount: 9 })
  })

  it('ends a line at LF, 0x1a or NUL', () => {
    // Arrange
    const bytes = encode('a\nb\x1ac\x00')

    // Act
    const lines = [0, 2, 4].map((position) => readJamTextLine(bytes, position, 0x104))

    // Assert
    expect(lines).toEqual([
      { text: 'a', consumedByteCount: 2 },
      { text: 'b', consumedByteCount: 2 },
      { text: 'c', consumedByteCount: 2 },
    ])
  })

  it('keeps a carriage return that is not followed by a line feed', () => {
    // Arrange
    const bytes = encode('a\rb\n')

    // Act
    const line = readJamTextLine(bytes, 0, 0x104)

    // Assert
    expect(line).toEqual({ text: 'a\rb', consumedByteCount: 4 })
  })

  it('returns the rest of the file when it ends without a line end', () => {
    // Arrange
    const bytes = encode('x\r\nfoot.pcm')

    // Act
    const line = readJamTextLine(bytes, 3, 0x104)

    // Assert
    expect(line).toEqual({ text: 'foot.pcm', consumedByteCount: 8 })
  })

  it('drops the last character of a line that fills the whole buffer', () => {
    // Arrange
    const bytes = encode('100\r\n')

    // Act
    const line = readJamTextLine(bytes, 0, 4)

    // Assert
    expect(line).toEqual({ text: '100', consumedByteCount: 4 })
  })

  it('reports the end of the file', () => {
    // Arrange
    const bytes = encode('a\n')

    // Act
    const line = readJamTextLine(bytes, 2, 0x104)

    // Assert
    expect(line).toBeUndefined()
  })
})
