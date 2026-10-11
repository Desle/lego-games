import {
  BEST_TIME_TRACK_COUNT,
  GRAPHICS_DEVICE_BYTE_COUNT,
  HEADER_DATA_BYTE_COUNT,
  INPUT_CODE_COUNT,
  INPUT_CONFIGURATION_COUNT,
  RESERVED_OFFSET,
} from '../../types/save-layout/save-layout.ts'
import type { BestTime, SaveProfile } from '../../types/save-data.types.ts'
import {
  ALL_GHOSTS_BEATEN_FLAGS,
  BestTimeKind,
  CHAMPION_GHOST_COUNT,
  GHOSTS_BEATEN_TROPHY_FLAG,
  MAXIMUM_UNLOCK_CIRCUIT_INDEX,
  NO_BEST_TIME,
  PART_REQUIRING_ALL_GHOSTS,
  PART_TROPHY_BASE_REQUIREMENT,
} from '../../types/progression-flags/progression-flags.ts'
import type {
  BestTimeKind as BestTimeKindValue,
  BestTimeUpdate,
  GhostBeatenUpdate,
} from '../../types/progression-flags/progression-flags.types.ts'

const getZeroBytes = (count: number): readonly number[] =>
  Object.freeze(new Array<number>(count).fill(0))

const getChanged = (profile: SaveProfile, changes: Partial<SaveProfile>): SaveProfile =>
  Object.freeze({ ...profile, ...changes })

// FUN_0042f1f0 returns the byte ORed with 1: circuit 0 is always unlocked.
export const getCircuitUnlockFlags = (profile: SaveProfile): number =>
  profile.circuitUnlockFlags | 1

export const getIsCircuitUnlocked = (profile: SaveProfile, circuitIndex: number): boolean =>
  (getCircuitUnlockFlags(profile) & (1 << circuitIndex)) !== 0

// FUN_0042f220: the front end ORs a circuit's bit in when the circuit before it is finished in the first two places.
export const unlockCircuit = (profile: SaveProfile, circuitIndex: number): SaveProfile =>
  getChanged(profile, {
    circuitUnlockFlags: (profile.circuitUnlockFlags | (1 << circuitIndex)) & 0xff,
  })

export const getHasCircuitTrophy = (profile: SaveProfile, circuitIndex: number): boolean =>
  (profile.trophyFlags & (1 << circuitIndex)) !== 0

// FUN_0042f200 (called by FUN_00476990 for a first place and by FUN_0042e680 with 0x80).
export const setTrophyFlags = (profile: SaveProfile, flags: number): SaveProfile =>
  getChanged(profile, { trophyFlags: (profile.trophyFlags | flags) & 0xff })

// FUN_00443760: how many circuits after the first are unlocked in a row (0..6).
export const getUnlockedCircuitRunLength = (profile: SaveProfile): number => {
  const flags = getCircuitUnlockFlags(profile)
  let length = 0
  while (length < MAXIMUM_UNLOCK_CIRCUIT_INDEX && (flags & (2 << length)) !== 0) length += 1
  return length
}

// FUN_0042f280.
export const getAreAllGhostsBeaten = (profile: SaveProfile): boolean =>
  profile.ghostBeatenFlags === ALL_GHOSTS_BEATEN_FLAGS

// FUN_00483c60 and its three twins: a driver part is free below 3, needs every ghost beaten at 0x80, and otherwise
// needs the trophy of circuit `requirement - 3`.
export const getIsPartUnlocked = (profile: SaveProfile, requirement: number): boolean => {
  if (requirement === PART_REQUIRING_ALL_GHOSTS) return getAreAllGhostsBeaten(profile)
  if (requirement < PART_TROPHY_BASE_REQUIREMENT) return true
  return getHasCircuitTrophy(profile, requirement - PART_TROPHY_BASE_REQUIREMENT)
}

// FUN_0042f250 and FUN_0042e680 (race index below 12 only): the champion ghost of race `raceIndex` is beaten. When all
// twelve are, the profile gets trophy bit 0x80 and the front end shows menu screen 0x1c.
export const markGhostBeaten = (profile: SaveProfile, raceIndex: number): GhostBeatenUpdate => {
  const flag = 1 << raceIndex
  if (raceIndex >= CHAMPION_GHOST_COUNT || (profile.ghostBeatenFlags & flag) !== 0) {
    return Object.freeze({ profile, isNewlyBeaten: false, isFinalGhostBeaten: false })
  }
  const beaten = getChanged(profile, { ghostBeatenFlags: profile.ghostBeatenFlags | flag })
  const isFinalGhostBeaten = getAreAllGhostsBeaten(beaten)
  return Object.freeze({
    profile: isFinalGhostBeaten ? setTrophyFlags(beaten, GHOSTS_BEATEN_TROPHY_FLAG) : beaten,
    isNewlyBeaten: true,
    isFinalGhostBeaten,
  })
}

// FUN_0042f290 / FUN_0042f310 index the 13 tracks of a table with the race's position in LEGORACE.RCB: past 12 they
// take 13 off once, so the mirrored second pass of the circuits lands on the tracks of the first, and 26 has none.
export const getBestTimeTrackIndex = (raceIndex: number): number | null => {
  const reduced =
    raceIndex > BEST_TIME_TRACK_COUNT - 1 ? raceIndex - BEST_TIME_TRACK_COUNT : raceIndex
  return reduced > BEST_TIME_TRACK_COUNT - 1 ? null : reduced
}

export const getBestTime = (
  profile: SaveProfile,
  raceIndex: number,
  kind: BestTimeKindValue
): BestTime => {
  const track = getBestTimeTrackIndex(raceIndex)
  const times = kind === BestTimeKind.LAP ? profile.bestLapTimes : profile.bestRaceTimes
  return (track === null ? undefined : times[track]) ?? NO_BEST_TIME
}

// FUN_0042f310: a time replaces the stored one when none is stored or it is strictly smaller.
export const recordBestTime = (
  profile: SaveProfile,
  raceIndex: number,
  kind: BestTimeKindValue,
  milliseconds: number,
  holderName: string
): BestTimeUpdate => {
  const track = getBestTimeTrackIndex(raceIndex)
  const stored = getBestTime(profile, raceIndex, kind)
  if (track === null || (stored.milliseconds !== 0 && stored.milliseconds <= milliseconds)) {
    return Object.freeze({ profile, isRecorded: false })
  }
  const entry: BestTime = Object.freeze({ milliseconds, holderName })
  const replace = (times: readonly BestTime[]): readonly BestTime[] =>
    Object.freeze(times.map((time, index) => (index === track ? entry : time)))
  return Object.freeze({
    profile:
      kind === BestTimeKind.LAP
        ? getChanged(profile, { bestLapTimes: replace(profile.bestLapTimes) })
        : getChanged(profile, { bestRaceTimes: replace(profile.bestRaceTimes) }),
    isRecorded: true,
  })
}

// FUN_0042e8a0: the profile a new game starts from. Everything is zero except these bytes; the language comes from
// the registry's LangID (see getLanguageIndex), the 3D device is stored later (FUN_0042f020).
export const createDefaultProfile = (languageIndex: number): SaveProfile => {
  const times = Object.freeze(Array.from({ length: BEST_TIME_TRACK_COUNT }, () => NO_BEST_TIME))
  return Object.freeze({
    trophyFlags: 0,
    circuitUnlockFlags: 0,
    ghostBeatenFlags: 0,
    bestLapTimes: times,
    bestRaceTimes: times,
    racerCountOption: 5,
    graphicsDeviceIdentifier: getZeroBytes(GRAPHICS_DEVICE_BYTE_COUNT),
    optionBytes: Object.freeze([0, 0x80, 0xff, 0xff, 1, languageIndex, 3]),
    playerControlBytes: Object.freeze([Object.freeze([0, 2, 0, 0]), Object.freeze([0, 2, 0, 1])]),
    inputConfigurations: Object.freeze(
      Array.from({ length: INPUT_CONFIGURATION_COUNT }, () =>
        Object.freeze({
          kind: 0,
          secondKind: 0,
          deviceIndex: 0,
          codes: getZeroBytes(INPUT_CODE_COUNT),
        })
      )
    ),
    reservedBytes: getZeroBytes(HEADER_DATA_BYTE_COUNT - RESERVED_OFFSET),
  })
}
