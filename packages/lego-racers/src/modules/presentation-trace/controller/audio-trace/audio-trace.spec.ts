import { compareAudioCalls, getOriginalAudioCalls } from './audio-trace.ts'
import type { AudioFrameCalls } from './audio-trace.types.ts'

describe('getOriginalAudioCalls', () => {
  it('turns sound requests and the opened tune into calls', () => {
    // Arrange
    const frames = [
      {
        frame: -1,
        events: [
          { kind: 'musicOpen', values: { index: 0, name: 'start.tun' } },
          { kind: 'streamPlay', values: { stream: 'start.tun', isLooping: false } },
        ],
      },
      {
        frame: 69,
        events: [
          { kind: 'soundPlayAt', values: { id: 62, from: '0x439402' } },
          { kind: 'bufferVolume', values: { buffer: 1, volume: 0 } },
        ],
      },
    ]

    // Act
    const calls = getOriginalAudioCalls(frames)

    // Assert
    expect(calls).toEqual([
      { frame: -1, calls: [{ kind: 'music', listIndex: 0, isLooping: false }] },
      { frame: 69, calls: [{ kind: 'sound', soundId: 62, address: '0x439402' }] },
    ])
  })
})

describe('compareAudioCalls', () => {
  const sound = (soundId: number, address: string | null = null) =>
    ({ kind: 'sound', soundId, address }) as const

  it('summarises a sound only the original plays and one both play', () => {
    // Arrange
    const original: AudioFrameCalls[] = [
      { frame: 10, calls: [sound(1, '0x1'), sound(2, '0x2')] },
      { frame: 20, calls: [sound(2, '0x2')] },
    ]
    const port: AudioFrameCalls[] = [{ frame: 10, calls: [sound(1)] }]

    // Act
    const comparison = compareAudioCalls(original, port)

    // Assert
    expect(comparison.sounds).toEqual([
      {
        soundId: 1,
        originalCount: 1,
        portCount: 1,
        firstOriginalFrame: 10,
        firstPortFrame: 10,
        originalAddresses: ['0x1'],
        differingFrames: [],
      },
      {
        soundId: 2,
        originalCount: 2,
        portCount: 0,
        firstOriginalFrame: 10,
        firstPortFrame: null,
        originalAddresses: ['0x2'],
        differingFrames: [10, 20],
      },
    ])
  })

  it('reports the frame a tune differs in', () => {
    // Arrange
    const original: AudioFrameCalls[] = [
      { frame: 160, calls: [{ kind: 'music', listIndex: 5, isLooping: true }] },
    ]
    const port: AudioFrameCalls[] = [
      { frame: 160, calls: [{ kind: 'music', listIndex: 1, isLooping: true }] },
    ]

    // Act
    const comparison = compareAudioCalls(original, port)

    // Assert
    expect(comparison.musicDifferences).toEqual([
      {
        frame: 160,
        original: { kind: 'music', listIndex: 5, isLooping: true },
        port: { kind: 'music', listIndex: 1, isLooping: true },
      },
    ])
  })
})
