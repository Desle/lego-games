import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { createSoundReplacements } from './sound-replacements.ts'

describe('createSoundReplacements', () => {
  afterEach(() => clearViewerExtensions())

  it('has nothing without an extension', async () => {
    // Arrange
    const replacements = createSoundReplacements({} as AudioContext)

    // Act
    const loaded = await replacements.load('A.PCM')

    // Assert
    expect([loaded, replacements.getLoaded('A.PCM')]).toEqual([null, null])
  })

  it('asks an extension once per path and hands the buffer out once loaded', async () => {
    // Arrange
    const buffer = {} as AudioBuffer
    const getSoundReplacement = vi.fn(() => Promise.resolve(buffer))
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getSoundReplacement })
    const replacements = createSoundReplacements({} as AudioContext)

    // Act
    const first = replacements.getLoaded('A.PCM')
    await replacements.load('A.PCM')
    const second = replacements.getLoaded('A.PCM')

    // Assert
    expect([first, second, getSoundReplacement.mock.calls.length]).toEqual([null, buffer, 1])
  })
})
