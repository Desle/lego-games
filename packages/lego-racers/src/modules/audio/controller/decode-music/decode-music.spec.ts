import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MusicReadError } from '../../types/audio-errors/audio-errors.ts'
import { decodeMusic } from './decode-music.ts'

const ORIGINAL_GAME_DIRECTORY = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files'
)

const ADPCM_DATA = [0x07, 0x70, 0xf8, 0x8f, 0x33]

const createTune = (channelCount: number, data: readonly number[]): Uint8Array => {
  const bytes = new Uint8Array(16 + data.length)
  bytes.set([0x41, 0x4c, 0x50, 0x20, 0x08, 0x00, 0x00, 0x00], 0)
  bytes.set([0x41, 0x44, 0x50, 0x43, 0x4d, 0x00, 0x00, channelCount], 8)
  bytes.set(data, 16)
  return bytes
}

const getSum = (samples: Int16Array): number => samples.reduce((total, sample) => total + sample, 0)

const getTunePaths = (): readonly string[] =>
  readdirSync(ORIGINAL_GAME_DIRECTORY)
    .filter((name) => name.toLowerCase().endsWith('.tun'))
    .map((name) => resolve(ORIGINAL_GAME_DIRECTORY, name))

// Decoding all 50 original tunes takes about 2 s alone and over 5 s on a loaded machine.
const ALL_TUNES_TIMEOUT_IN_MILLISECONDS = 60_000

describe('decodeMusic', () => {
  it('decodes stereo music to 22050 Hz interleaved stereo', () => {
    // Arrange
    const bytes = createTune(2, ADPCM_DATA)

    // Act
    const music = decodeMusic(bytes)

    // Assert
    expect(music).toMatchObject({ storedChannelCount: 2, channelCount: 2, sampleRate: 22050 })
    expect([...music.samples]).toEqual([0, 12, 12, 12, -16, 12, -16, -10])
  })

  it('plays every other channel count as mono on both channels', () => {
    // Arrange
    const bytes = createTune(1, [0x07])

    // Act
    const music = decodeMusic(bytes)

    // Assert
    expect(music).toMatchObject({ storedChannelCount: 1, channelCount: 2, sampleRate: 22050 })
    expect([...music.samples]).toEqual([0, 0, 12, 12])
  })

  it('reads a file without an ALP header as mono ADPCM from the first byte', () => {
    // Arrange
    const bytes = new Uint8Array([0x07])

    // Act
    const music = decodeMusic(bytes)

    // Assert
    expect(music.storedChannelCount).toBe(1)
    expect([...music.samples]).toEqual([0, 0, 12, 12])
  })

  it('rejects a header that ends beyond the file', () => {
    // Arrange
    const bytes = createTune(2, [])
    bytes[4] = 0x40

    // Act
    const decode = () => decodeMusic(bytes)

    // Assert
    expect(decode).toThrow(MusicReadError)
  })

  it.skipIf(!existsSync(ORIGINAL_GAME_DIRECTORY))(
    'decodes every original .tun file as stereo with four samples per byte pair',
    () => {
      // Arrange
      const tunePaths = getTunePaths()

      // Act
      const decoded = tunePaths.map((path) => {
        const bytes = new Uint8Array(readFileSync(path))
        return { byteLength: bytes.byteLength, music: decodeMusic(bytes) }
      })

      // Assert
      expect(decoded).toHaveLength(50)
      for (const { byteLength, music } of decoded) {
        expect(music.storedChannelCount).toBe(2)
        expect(music.samples).toHaveLength(((byteLength - 16) >> 1) * 4)
      }
    },
    ALL_TUNES_TIMEOUT_IN_MILLISECONDS
  )

  it.skipIf(!existsSync(ORIGINAL_GAME_DIRECTORY))(
    'decodes win.tun to the reference samples',
    () => {
      // Arrange
      const bytes = new Uint8Array(readFileSync(resolve(ORIGINAL_GAME_DIRECTORY, 'win.tun')))

      // Act
      const music = decodeMusic(bytes)

      // Assert
      expect(music.samples).toHaveLength(340284)
      expect([...music.samples.subarray(0, 8)]).toEqual([0, 0, -5, 12, -6, -8, -3, -8])
      expect(getSum(music.samples)).toBe(-1022368)
    }
  )
})
