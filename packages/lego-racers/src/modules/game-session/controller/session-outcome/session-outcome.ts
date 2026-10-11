import { findNamedRecord } from '../../../named-record/index.ts'
import {
  ALL_GHOSTS_BEATEN_SCREEN,
  BestTimeKind,
  getIsCircuitUnlocked,
  markGhostBeaten,
  recordBestTime,
  recordCircuitRank,
  setTrophyFlags,
  unlockCircuit,
} from '../../../save-data/index.ts'
import type { SaveFile, SaveProfile } from '../../../save-data/index.ts'
import type { GameSession } from '../../types/game-session.types.ts'
import type {
  CircuitResultApplication,
  SessionSaveOutcome,
  TimeRecordApplication,
} from './session-outcome.types.ts'

const FIRST_PLACE_SCREEN = 0x16
const SECOND_PLACE_SCREEN = 0x17
const THIRD_PLACE_SCREEN = 0x18

const getCatalogIndex = (session: GameSession, slot: number): number =>
  session.resources.catalog.entries.findIndex(
    (entry) => entry.name === session.settings.raceNames[slot]
  )

const getHolderName = (session: GameSession, racerIndex: number): string =>
  session.settings.playerNames[racerIndex] ?? ''

// FUN_0042e490 and FUN_0042e680, which the front end runs when it comes back from a session: after a race with a ghost
// (settings flag 0x10) each slot's best lap and best race time go into the profile's tables under the race's position
// in the catalog; when the best run beat the champion (flag 0x01) the race's bit is set in the profile and, with the
// twelfth, the front end opens menu screen 0x1c.
export const applySessionTimesToProfile = (
  session: GameSession,
  profile: SaveProfile
): TimeRecordApplication => {
  const timed = session.isTimeRecordPending
    ? session.raceTimes.reduce((current, record, slot) => {
        const raceIndex = getCatalogIndex(session, slot)
        const lap =
          record.bestLapMilliseconds === 0
            ? current
            : recordBestTime(
                current,
                raceIndex,
                BestTimeKind.LAP,
                record.bestLapMilliseconds,
                getHolderName(session, record.bestLapRacerIndex)
              ).profile
        return record.bestRaceMilliseconds === 0
          ? lap
          : recordBestTime(
              lap,
              raceIndex,
              BestTimeKind.RACE,
              record.bestRaceMilliseconds,
              getHolderName(session, record.bestRaceRacerIndex)
            ).profile
      }, profile)
    : profile
  const beaten = session.isChampionBeaten
    ? markGhostBeaten(timed, getCatalogIndex(session, 0))
    : null
  return Object.freeze({
    profile: beaten === null ? timed : beaten.profile,
    isChampionBeaten: beaten?.isNewlyBeaten ?? false,
    resultScreen: beaten?.isFinalGhostBeaten === true ? ALL_GHOSTS_BEATEN_SCREEN : null,
  })
}

// FUN_004767b0, when the front end enters result screen 0x16, 0x17 or 0x18: the racer's record keeps the place won in
// the circuit (1, 2 or 3 if it is better than before), the first place sets the circuit's trophy bit
// (`secondNumber` of the circuit), and the first and second places unlock the circuit named by the circuit's
// `nextName`. `racerRecordIndex` is the racer record of the save file that played.
export const applyCircuitResultToSave = (
  session: GameSession,
  saveFile: SaveFile,
  resultScreen: number,
  racerRecordIndex: number
): CircuitResultApplication => {
  const { circuits } = session.resources
  const circuit = findNamedRecord(circuits.circuits, session.settings.circuitName)
  const place = resultScreen - FIRST_PLACE_SCREEN + 1
  const racer = saveFile.racers[racerRecordIndex]
  if (
    circuit === null ||
    racer === undefined ||
    resultScreen < FIRST_PLACE_SCREEN ||
    resultScreen > THIRD_PLACE_SCREEN
  ) {
    return Object.freeze({
      saveFile,
      isRankRecorded: false,
      isTrophyAwarded: false,
      unlockedCircuitName: null,
    })
  }
  const circuitIndex = circuits.circuits.indexOf(circuit)
  const ranked = recordCircuitRank(racer, circuitIndex, place)
  const isFirstPlace = resultScreen === FIRST_PLACE_SCREEN
  const trophyFlag = 1 << circuit.secondNumber
  const isTrophyAwarded = isFirstPlace && (saveFile.profile.trophyFlags & trophyFlag) === 0
  const candidate = findNamedRecord(circuits.circuits, circuit.nextName)
  const nextIndex = candidate === null ? -1 : circuits.circuits.indexOf(candidate)
  const unlocked =
    resultScreen <= SECOND_PLACE_SCREEN &&
    circuit.nextName !== '' &&
    !getIsCircuitUnlocked(saveFile.profile, nextIndex)
      ? candidate
      : null
  const awarded = isTrophyAwarded ? setTrophyFlags(saveFile.profile, trophyFlag) : saveFile.profile
  const profile = unlocked === null ? awarded : unlockCircuit(awarded, nextIndex)
  return Object.freeze({
    saveFile: Object.freeze({
      profile,
      racers: Object.freeze(
        saveFile.racers.map((candidate, index) =>
          index === racerRecordIndex ? ranked.racer : candidate
        )
      ),
    }),
    isRankRecorded: ranked.isRecorded,
    isTrophyAwarded,
    unlockedCircuitName: unlocked?.name ?? null,
  })
}

// What the front end does when a session ends (0x0042e490, 0x0042e680, then the result screen's 0x004767b0): the best times,
// the beaten champion, the circuit's place, trophy and unlock go into the save, and the screen to open may change (0x1c).
export const applySessionOutcomeToSave = (
  session: GameSession,
  saveFile: SaveFile,
  racerRecordIndex: number
): SessionSaveOutcome => {
  const times = applySessionTimesToProfile(session, saveFile.profile)
  const resultScreen = times.resultScreen ?? session.resultScreen
  const timed: SaveFile = Object.freeze({ ...saveFile, profile: times.profile })
  const circuit = applyCircuitResultToSave(session, timed, resultScreen, racerRecordIndex)
  return Object.freeze({ saveFile: circuit.saveFile, resultScreen })
}
