import { encodeWav } from './wav-encoder.ts'

describe('encodeWav', () => {
  it('writes a 16-bit PCM header followed by the samples', () => {
    // Arrange
    const samples = Int16Array.from([1, -2, 3, -4])

    // Act
    const wav = Buffer.from(encodeWav({ channelCount: 2, sampleRate: 22050, samples }))

    // Assert
    expect(wav.toString('latin1', 0, 4)).toBe('RIFF')
    expect(wav.toString('latin1', 8, 16)).toBe('WAVEfmt ')
    expect(wav.readUInt16LE(22)).toBe(2)
    expect(wav.readUInt32LE(24)).toBe(22050)
    expect(wav.readUInt32LE(28)).toBe(22050 * 4)
    expect(wav.readUInt32LE(40)).toBe(8)
    expect(wav.readInt16LE(46)).toBe(-2)
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8)
  })
})
