import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { SoundEffectReadError } from '../../types/audio-errors/audio-errors.ts'
import { decodeSoundEffect } from './decode-sound-effect.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const ADPCM_DATA = [0x07, 0x70, 0xf8, 0x8f]

const createAlpFile = (
  headerSize: number,
  channelCount: number,
  sampleRate: number,
  data: readonly number[]
): Uint8Array => {
  const dataOffset = headerSize + 8
  const bytes = new Uint8Array(dataOffset + data.length)
  const view = new DataView(bytes.buffer)
  bytes.set([0x41, 0x4c, 0x50, 0x20], 0)
  view.setUint32(4, headerSize, true)
  bytes.set([0x41, 0x44, 0x50, 0x43, 0x4d, 0x00, 0x00, channelCount], 8)
  if (headerSize >= 12) view.setUint32(16, sampleRate, true)
  bytes.set(data, dataOffset)
  return bytes
}

const getSum = (samples: Int16Array): number => samples.reduce((total, sample) => total + sample, 0)

describe('decodeSoundEffect', () => {
  it('doubles a mono sound stored at 11025 Hz by interpolation', () => {
    // Arrange
    const bytes = createAlpFile(12, 1, 11025, ADPCM_DATA)

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect).toMatchObject({
      channelCount: 1,
      storedSampleRate: 11025,
      isRateDoubled: true,
      sampleRate: 22050,
    })
    expect([...soundEffect.samples]).toEqual([
      0, 0, 6, 12, 26, 40, 40, 40, 13, -14, -14, -14, -14, -14, -62, -110,
    ])
  })

  it('keeps a sound stored above 11025 Hz at its own rate', () => {
    // Arrange
    const bytes = createAlpFile(12, 1, 44100, ADPCM_DATA)

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect).toMatchObject({ isRateDoubled: false, sampleRate: 44100 })
    expect([...soundEffect.samples]).toEqual([0, 12, 40, 40, -14, -14, -14, -110])
  })

  it('assumes 11025 Hz when the header has no sample rate', () => {
    // Arrange
    const bytes = createAlpFile(8, 1, 0, ADPCM_DATA)

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect).toMatchObject({
      storedSampleRate: 11025,
      isRateDoubled: true,
      sampleRate: 22050,
    })
    expect(soundEffect.samples).toHaveLength(16)
  })

  it('does not double a stereo sound without a stored sample rate', () => {
    // Arrange
    const bytes = createAlpFile(8, 2, 0, ADPCM_DATA)

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect).toMatchObject({ channelCount: 2, isRateDoubled: false, sampleRate: 11025 })
    expect([...soundEffect.samples]).toEqual([0, 12, 12, 12, -16, 12, -16, -10])
  })

  it('fills only the first half of a doubled stereo buffer, as the original does', () => {
    // Arrange
    const bytes = createAlpFile(12, 2, 11025, ADPCM_DATA)

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect).toMatchObject({ isRateDoubled: true, sampleRate: 22050 })
    expect([...soundEffect.samples]).toEqual([
      0, 12, 12, 12, -16, 12, -16, -10, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
  })

  it('reads a file without an ALP header as mono 11025 Hz ADPCM from the first byte', () => {
    // Arrange
    const bytes = new Uint8Array(ADPCM_DATA)

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect).toMatchObject({ channelCount: 1, isRateDoubled: true, sampleRate: 22050 })
    expect(soundEffect.samples).toHaveLength(16)
  })

  it('ignores data bytes beyond a multiple of four', () => {
    // Arrange
    const bytes = createAlpFile(12, 1, 44100, [...ADPCM_DATA, 0x77, 0x77, 0x77])

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect.samples).toHaveLength(8)
  })

  it('decodes nothing when less than four data bytes remain', () => {
    // Arrange
    const bytes = createAlpFile(12, 1, 11025, [0x77, 0x77, 0x77])

    // Act
    const soundEffect = decodeSoundEffect(bytes)

    // Assert
    expect(soundEffect.samples).toHaveLength(0)
  })

  it('rejects a channel count other than one or two', () => {
    // Arrange
    const silent = createAlpFile(12, 0, 11025, ADPCM_DATA)
    const surround = createAlpFile(12, 3, 11025, ADPCM_DATA)

    // Act
    const decodeSilent = () => decodeSoundEffect(silent)
    const decodeSurround = () => decodeSoundEffect(surround)

    // Assert
    expect(decodeSilent).toThrow(SoundEffectReadError)
    expect(decodeSurround).toThrow(SoundEffectReadError)
  })

  it('rejects a header that ends beyond the file', () => {
    // Arrange
    const bytes = createAlpFile(12, 1, 11025, [])
    new DataView(bytes.buffer).setUint32(4, 100, true)

    // Act
    const decode = () => decodeSoundEffect(bytes)

    // Assert
    expect(decode).toThrow(SoundEffectReadError)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'decodes every .PCM in the original LEGO.JAM to the size of its DirectSound buffer',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.endsWith('.PCM'))

      // Act
      const decoded = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, soundEffect: decodeSoundEffect(bytes) }
      })

      // Assert
      expect(decoded).toHaveLength(730)
      for (const { byteLength, soundEffect } of decoded) {
        const dataLength = (byteLength - 20) & ~3
        const samplesPerByte = soundEffect.isRateDoubled ? 4 : 2
        expect(soundEffect.channelCount).toBe(1)
        expect([5512, 11025, 44100]).toContain(soundEffect.storedSampleRate)
        expect(soundEffect.isRateDoubled).toBe(soundEffect.storedSampleRate <= 11025)
        expect(soundEffect.samples).toHaveLength(dataLength * samplesPerByte)
      }
    }
  )

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'decodes GAMEDATA\\COMMON\\GO.PCM to the reference samples',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const bytes = archive.readFile('GAMEDATA\\COMMON\\GO.PCM')

      // Act
      const soundEffect = decodeSoundEffect(bytes)

      // Assert
      expect(soundEffect.sampleRate).toBe(22050)
      expect(soundEffect.samples).toHaveLength(11616)
      expect([...soundEffect.samples.subarray(0, 8)]).toEqual([6, 12, -2, -16, -46, -75, -12, 52])
      expect(getSum(soundEffect.samples)).toBe(-1768065)
    }
  )

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'decodes sounds stored at 44100 Hz and 5512 Hz to the reference samples',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const trophy = archive.readFile('MENUDATA\\C_AWARD3\\TROPHY.PCM')
      const frog = archive.readFile('GAMEDATA\\RACEC1R0\\FROGGER1.PCM')

      // Act
      const trophySound = decodeSoundEffect(trophy)
      const frogSound = decodeSoundEffect(frog)

      // Assert
      expect(trophySound.sampleRate).toBe(44100)
      expect(trophySound.samples).toHaveLength(17560)
      expect(getSum(trophySound.samples)).toBe(-59035)
      expect(frogSound.sampleRate).toBe(11024)
      expect(frogSound.samples).toHaveLength(4288)
      expect([...frogSound.samples.subarray(0, 8)]).toEqual([0, 0, 0, 0, -6, -12, -26, -40])
      expect(getSum(frogSound.samples)).toBe(-347560)
    }
  )
})
