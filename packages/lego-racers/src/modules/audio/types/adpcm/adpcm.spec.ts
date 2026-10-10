import {
  ADPCM_INDEX_TABLE,
  ADPCM_STEP_TABLE,
  decodeAdpcmMono,
  decodeAdpcmMonoDoubled,
  decodeAdpcmMonoToStereo,
  decodeAdpcmStereo,
} from './adpcm.ts'

const STANDARD_IMA_STEP_COUNT = 89

describe('ADPCM tables', () => {
  it('match the standard IMA ADPCM tables dumped from 0x004be640 and 0x004be680', () => {
    // Arrange
    const expectedFirstSteps = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17]

    // Act
    const firstSteps = ADPCM_STEP_TABLE.slice(0, 10)

    // Assert
    expect(ADPCM_INDEX_TABLE).toEqual([-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8])
    expect(ADPCM_STEP_TABLE).toHaveLength(STANDARD_IMA_STEP_COUNT)
    expect(firstSteps).toEqual(expectedFirstSteps)
    expect(ADPCM_STEP_TABLE.at(-1)).toBe(32767)
  })
})

describe('decodeAdpcmMono', () => {
  it('decodes the high nibble first with a difference of (magnitude * step) >> 2', () => {
    // Arrange
    const bytes = new Uint8Array([0x07, 0x70, 0xf8, 0x8f, 0x77, 0x77])

    // Act
    const samples = decodeAdpcmMono(bytes)

    // Assert
    expect([...samples]).toEqual([0, 12, 40, 40, -14, -14, -14, -110, 96, 538, 1490, 3530])
  })

  it('clamps the predictor to the signed 16-bit range', () => {
    // Arrange
    const rising = new Uint8Array(40).fill(0x77)
    const falling = new Uint8Array(40).fill(0xff)

    // Act
    const risingSamples = decodeAdpcmMono(rising)
    const fallingSamples = decodeAdpcmMono(falling)

    // Assert
    expect(risingSamples.at(-1)).toBe(32767)
    expect(fallingSamples.at(-1)).toBe(-32768)
  })
})

describe('decodeAdpcmMonoDoubled', () => {
  it('puts the arithmetic-shift average with the previous sample before every sample', () => {
    // Arrange
    const bytes = new Uint8Array([0x07, 0x70, 0xf8])

    // Act
    const samples = decodeAdpcmMonoDoubled(bytes)

    // Assert
    expect([...samples]).toEqual([0, 0, 6, 12, 26, 40, 40, 40, 13, -14, -14, -14])
  })
})

describe('decodeAdpcmMonoToStereo', () => {
  it('writes every mono sample to both channels', () => {
    // Arrange
    const bytes = new Uint8Array([0x07])

    // Act
    const samples = decodeAdpcmMonoToStereo(bytes)

    // Assert
    expect([...samples]).toEqual([0, 0, 12, 12])
  })
})

describe('decodeAdpcmStereo', () => {
  it('decodes alternating left and right bytes and drops a trailing unpaired byte', () => {
    // Arrange
    const bytes = new Uint8Array([0x07, 0x70, 0xf8, 0x8f, 0x33])

    // Act
    const samples = decodeAdpcmStereo(bytes)

    // Assert
    expect([...samples]).toEqual([0, 12, 12, 12, -16, 12, -16, -10])
  })
})
