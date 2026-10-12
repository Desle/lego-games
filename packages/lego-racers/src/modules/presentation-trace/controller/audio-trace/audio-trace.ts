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
// Looped sounds are counted under their sound id plus this, apart from the one-shots with the same id.
export const LOOPED_SOUND_ID_OFFSET = 100_000
// The engine's idle, middle, high and skid loops, and the nearest racer's.
const CHECKED_LOOP_SOUND_IDS: readonly number[] = [0x20, 10, 0x3d, 3, 0x4f]

// The sound and music requests of the original's DirectSound trace: sound ids from the race's sound player, and a tune
// from the music list entry the streamer opened (0x0041a8a0) and the play slot's loop flag.
export const getOriginalAudioCalls = (
  frames: readonly OriginalAudioFrame[]
): readonly AudioFrameCalls[] => {
  let musicIndex = -1
  // RaceSounds_Get (0x00443bd0) hands out a sound object (its address is in the event); playing it with 1 (slot +4,
  // 0x0041ad80) loops the sound.
  const soundIdOfObject = new Map<number, number>()
  const lastLoopFrames = new Map<number, number>()
  return frames.map(({ frame, events }) => {
    const calls = events.flatMap((event): readonly AudioCall[] => {
      if (event.kind === 'soundGet') {
        soundIdOfObject.set(event.values['object'] as number, event.values['id'] as number)
        return []
      }
      if (event.kind === 'objectPlay') {
        const soundId = soundIdOfObject.get(event.values['object'] as number)
        if (soundId === undefined || event.values['loop'] === 0) return []
        // The racers' engine loops and the nearest racer's check slot +0xc and then play (0x00437d40, 0x0043c1b0). The
        // emulator's sound pool is smaller than a PC's, so a loop that finds no free voice is started again by every
        // frame's check: a start on the frame after a start of the same sound is the same start.
        const previousFrame = lastLoopFrames.get(soundId)
        if (CHECKED_LOOP_SOUND_IDS.includes(soundId)) lastLoopFrames.set(soundId, frame)
        return previousFrame === frame - 1
          ? []
          : [
              {
                kind: 'sound',
                soundId: soundId + LOOPED_SOUND_ID_OFFSET,
                address: event.values['from'] as string,
              },
            ]
      }
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
