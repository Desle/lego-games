import {
  getAudioKey,
  getHighDefinitionAudioUrl,
  getHighDefinitionAudioVariant,
  loadHighDefinitionSound,
} from './high-definition-audio.ts'

describe('getAudioKey', () => {
  it('maps sounds and tunes of the archive to the pack file', () => {
    // Arrange
    const paths = ['MENUDATA\\SOUNDS\\BIRD2.PCM', 'GAMEDATA\\COMMON\\SPIN.PCM', 'MUSIC\\theme.tun']

    // Act
    const keys = paths.map(getAudioKey)

    // Assert
    expect(keys).toEqual([
      'MENUDATA/SOUNDS/BIRD2.wav',
      'GAMEDATA/COMMON/SPIN.wav',
      'MUSIC/theme.wav',
    ])
  })
})

describe('getHighDefinitionAudioVariant', () => {
  it('needs both ?hd and audio, and uses the default pack for a bare audio flag', () => {
    // Arrange
    const searches = ['?audio=x', '?hd', '?hd&audio=samples', '?hd&audio']

    // Act
    const variants = searches.map(getHighDefinitionAudioVariant)

    // Assert
    expect(variants).toEqual([null, null, 'samples', 'resample-48k'])
  })
})

describe('getHighDefinitionAudioUrl', () => {
  it('points at the dev server route', () => {
    // Arrange
    const path = 'MUSIC\\theme.tun'

    // Act
    const url = getHighDefinitionAudioUrl(path, 'resample-48k')

    // Assert
    expect(url).toBe('/__development/high-definition-audio/resample-48k/MUSIC/theme.wav')
  })
})

describe('loadHighDefinitionSound', () => {
  it('fetches only what the pack index lists', async () => {
    // Arrange
    const buffer = { duration: 1 } as unknown as AudioBuffer
    const context = { decodeAudioData: vi.fn(() => Promise.resolve(buffer)) }
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/index-pack/')
          ? new Response(JSON.stringify(['music/theme.wav']))
          : new Response(new ArrayBuffer(4))
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    // Act
    const present = await loadHighDefinitionSound(
      context as unknown as BaseAudioContext,
      'MUSIC\\theme.tun',
      'index-pack'
    )
    const absent = await loadHighDefinitionSound(
      context as unknown as BaseAudioContext,
      'MUSIC\\other.tun',
      'index-pack'
    )

    // Assert
    expect([present, absent, fetchMock.mock.calls.length]).toEqual([buffer, null, 2])
    vi.unstubAllGlobals()
  })
})
