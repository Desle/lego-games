import { drawRandomRemainder, drawRandomValue } from '../../../random-table/index.ts'
import type { BrickKind, RacerPowerUps, RandomState } from '../power-ups.types.ts'
import type {
  EnhancementCollectResult,
  EnhancementDropResult,
  EnhancementReleaseResult,
  VoiceResult,
} from './racer-power-ups.types.ts'

export const MAXIMUM_ENHANCEMENT_LEVEL = 3
// 0x00439210: a fresh brick is checked by the computer after 300 ms.
const USE_CHECK_DELAY_AFTER_PICKUP_MILLISECONDS = 300
// 0x00439240: the next voice waits table * 4 + 5000 ms.
const VOICE_COOLDOWN_BASE_MILLISECONDS = 5000
const VOICE_VARIANTS = 6

const EMPTY_SLOTS: RacerPowerUps['enhancementBrickIndices'] = Object.freeze([null, null, null])

export const createRacerPowerUps = (
  voiceSoundBase: number,
  voiceCooldownMilliseconds: number
): RacerPowerUps =>
  Object.freeze({
    heldBrickKind: null,
    enhancementLevel: 0,
    enhancementBrickIndices: EMPTY_SLOTS,
    useCheckElapsedMilliseconds: 0,
    useCheckIntervalMilliseconds: 0,
    voiceCooldownMilliseconds,
    voiceSoundBase,
  })

// 0x00439210.
export const getRacerWithBrick = (racer: RacerPowerUps, kind: BrickKind): RacerPowerUps =>
  Object.freeze({
    ...racer,
    heldBrickKind: kind,
    useCheckElapsedMilliseconds: 0,
    useCheckIntervalMilliseconds: USE_CHECK_DELAY_AFTER_PICKUP_MILLISECONDS,
  })

// 0x00439240 (thiscall, one stack argument): a taunt (1) or a complaint (0), only when the cooldown is 0.
export const getRacerVoice = (
  racer: RacerPowerUps,
  random: RandomState,
  isTaunt: boolean
): VoiceResult => {
  if (racer.voiceCooldownMilliseconds !== 0) {
    return Object.freeze({ racer, random, voiceSound: null })
  }
  const soundDraw = drawRandomRemainder(random.table, random.position, VOICE_VARIANTS)
  const voiceSound = racer.voiceSoundBase + soundDraw.value + (isTaunt ? VOICE_VARIANTS : 0)
  const cooldownDraw = drawRandomValue(random.table, soundDraw.position)
  return Object.freeze({
    racer: Object.freeze({
      ...racer,
      voiceCooldownMilliseconds: cooldownDraw.value * 4 + VOICE_COOLDOWN_BASE_MILLISECONDS,
    }),
    random: Object.freeze({ table: random.table, position: cooldownDraw.position }),
    voiceSound,
  })
}

const getSlotsWith = (
  slots: RacerPowerUps['enhancementBrickIndices'],
  slotIndex: number,
  brickIndex: number | null
): RacerPowerUps['enhancementBrickIndices'] =>
  Object.freeze([
    slotIndex === 0 ? brickIndex : slots[0],
    slotIndex === 1 ? brickIndex : slots[1],
    slotIndex === 2 ? brickIndex : slots[2],
  ] as const)

// 0x00439420: the first empty slot takes the brick; reaching level 3 plays a taunt.
export const getRacerWithEnhancement = (
  racer: RacerPowerUps,
  random: RandomState,
  brickIndex: number
): EnhancementCollectResult => {
  const slotIndex = racer.enhancementBrickIndices.indexOf(null)
  if (racer.enhancementLevel === MAXIMUM_ENHANCEMENT_LEVEL || slotIndex < 0) {
    return Object.freeze({ racer, random, isAccepted: false, voiceSound: null })
  }
  const enhancedRacer = Object.freeze({
    ...racer,
    enhancementBrickIndices: getSlotsWith(racer.enhancementBrickIndices, slotIndex, brickIndex),
    enhancementLevel: racer.enhancementLevel + 1,
  })
  if (enhancedRacer.enhancementLevel !== MAXIMUM_ENHANCEMENT_LEVEL) {
    return Object.freeze({ racer: enhancedRacer, random, isAccepted: true, voiceSound: null })
  }
  const voice = getRacerVoice(enhancedRacer, random, true)
  return Object.freeze({ ...voice, isAccepted: true })
}

// 0x00439490: a hit racer loses its first enhancement brick, which the caller drops at the racer.
export const getRacerAfterDrop = (racer: RacerPowerUps): EnhancementDropResult => {
  if (racer.enhancementLevel === 0) return Object.freeze({ racer, droppedBrickIndex: null })
  const slotIndex = racer.enhancementBrickIndices.findIndex((brickIndex) => brickIndex !== null)
  const droppedBrickIndex = racer.enhancementBrickIndices[slotIndex] ?? null
  if (droppedBrickIndex === null) return Object.freeze({ racer, droppedBrickIndex })
  return Object.freeze({
    racer: Object.freeze({
      ...racer,
      enhancementBrickIndices: getSlotsWith(racer.enhancementBrickIndices, slotIndex, null),
      enhancementLevel: racer.enhancementLevel - 1,
    }),
    droppedBrickIndex,
  })
}

// 0x00439520: using a brick releases every enhancement brick back to the track.
export const getRacerAfterRelease = (racer: RacerPowerUps): EnhancementReleaseResult => {
  if (racer.enhancementLevel === 0) return Object.freeze({ racer, releasedBrickIndices: [] })
  const releasedBrickIndices = racer.enhancementBrickIndices.filter(
    (brickIndex): brickIndex is number => brickIndex !== null
  )
  return Object.freeze({
    racer: Object.freeze({
      ...racer,
      enhancementBrickIndices: EMPTY_SLOTS,
      enhancementLevel: racer.enhancementLevel - releasedBrickIndices.length,
    }),
    releasedBrickIndices: Object.freeze(releasedBrickIndices),
  })
}

// 0x004377f0: racer +0xd44 counts down to 0 each sub-step.
export const getRacerWithVoiceCooldownAdvanced = (
  racer: RacerPowerUps,
  stepMilliseconds: number
): RacerPowerUps =>
  Object.freeze({
    ...racer,
    voiceCooldownMilliseconds:
      racer.voiceCooldownMilliseconds < stepMilliseconds
        ? 0
        : racer.voiceCooldownMilliseconds - stepMilliseconds,
  })
