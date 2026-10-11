import type { OriginalAudioFrame } from '../../types/presentation-trace.types.ts'
import type {
  AudioCall,
  AudioComparison,
  AudioFrameCalls,
  MusicCall,
  MusicDifference,
  SoundSummary,
} from './audio-trace.types.ts'

const MAXIMUM_DIFFERING_FRAMES = 10

// The sound and music requests of the original's DirectSound trace: sound ids from the race's sound player, and a tune
// from the music list entry the streamer opened (0x0041a8a0) and the play slot's loop flag.
export const getOriginalAudioCalls = (
  frames: readonly OriginalAudioFrame[]
): readonly AudioFrameCalls[] => {
  let musicIndex = -1
  return frames.map(({ frame, events }) => {
    const calls = events.flatMap((event): readonly AudioCall[] => {
      if (event.kind === 'soundPlayAt' || event.kind === 'soundPlay') {
        return [
          {
            kind: 'sound',
            soundId: event.values['id'] as number,
            address: event.values['from'] as string,
          },
        ]
      }
      if (event.kind === 'musicOpen') {
        musicIndex = event.values['index'] as number
        return []
      }
      if (event.kind === 'streamPlay') {
        return [
          { kind: 'music', listIndex: musicIndex, isLooping: event.values['isLooping'] === true },
        ]
      }
      return []
    })
    return Object.freeze({ frame, calls })
  })
}

const getSoundCounts = (frames: readonly AudioFrameCalls[]): Map<number, Map<number, number>> => {
  const counts = new Map<number, Map<number, number>>()
  for (const { frame, calls } of frames) {
    for (const call of calls) {
      if (call.kind !== 'sound') continue
      const perFrame = counts.get(call.soundId) ?? new Map<number, number>()
      perFrame.set(frame, (perFrame.get(frame) ?? 0) + 1)
      counts.set(call.soundId, perFrame)
    }
  }
  return counts
}

const getFirstFrame = (perFrame: Map<number, number> | undefined): number | null =>
  perFrame === undefined ? null : Math.min(...perFrame.keys())

const getTotal = (perFrame: Map<number, number> | undefined): number =>
  [...(perFrame?.values() ?? [])].reduce((sum, count) => sum + count, 0)

const getAddresses = (frames: readonly AudioFrameCalls[], soundId: number): readonly string[] => [
  ...new Set(
    frames.flatMap(({ calls }) =>
      calls.flatMap((call) =>
        call.kind === 'sound' && call.soundId === soundId && call.address !== null
          ? [call.address]
          : []
      )
    )
  ),
]

const getSoundSummary = (
  soundId: number,
  original: Map<number, number> | undefined,
  port: Map<number, number> | undefined,
  originalFrames: readonly AudioFrameCalls[]
): SoundSummary => {
  const frames = new Set([...(original?.keys() ?? []), ...(port?.keys() ?? [])])
  const differingFrames = [...frames]
    .filter((frame) => (original?.get(frame) ?? 0) !== (port?.get(frame) ?? 0))
    .sort((left, right) => left - right)
  return Object.freeze({
    soundId,
    originalCount: getTotal(original),
    portCount: getTotal(port),
    firstOriginalFrame: getFirstFrame(original),
    firstPortFrame: getFirstFrame(port),
    originalAddresses: getAddresses(originalFrames, soundId),
    differingFrames: differingFrames.slice(0, MAXIMUM_DIFFERING_FRAMES),
  })
}

const getMusicCalls = (frames: readonly AudioFrameCalls[]): Map<number, MusicCall> =>
  new Map(
    frames.flatMap(({ frame, calls }) =>
      calls
        .filter((call): call is MusicCall => call.kind === 'music')
        .map((call) => [frame, call] as const)
    )
  )

const getIsSameMusic = (left: MusicCall | undefined, right: MusicCall | undefined): boolean =>
  left?.listIndex === right?.listIndex && left?.isLooping === right?.isLooping

// Per sound id: how often and from which frame each side plays it; and the tunes frame by frame.
export const compareAudioCalls = (
  original: readonly AudioFrameCalls[],
  port: readonly AudioFrameCalls[]
): AudioComparison => {
  const originalCounts = getSoundCounts(original)
  const portCounts = getSoundCounts(port)
  const soundIds = [...new Set([...originalCounts.keys(), ...portCounts.keys()])].sort(
    (left, right) => left - right
  )
  const originalMusic = getMusicCalls(original)
  const portMusic = getMusicCalls(port)
  const musicFrames = [...new Set([...originalMusic.keys(), ...portMusic.keys()])].sort(
    (left, right) => left - right
  )
  const musicDifferences = musicFrames
    .filter((frame) => !getIsSameMusic(originalMusic.get(frame), portMusic.get(frame)))
    .map((frame): MusicDifference =>
      Object.freeze({
        frame,
        original: originalMusic.get(frame) ?? null,
        port: portMusic.get(frame) ?? null,
      })
    )
  return Object.freeze({
    sounds: soundIds.map((soundId) =>
      getSoundSummary(soundId, originalCounts.get(soundId), portCounts.get(soundId), original)
    ),
    musicDifferences,
  })
}
