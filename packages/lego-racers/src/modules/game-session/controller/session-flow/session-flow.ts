import {
  awardPlacePoints,
  CIRCUIT_RACE_COUNT,
  getCircuitResultScreen,
  getCircuitResultScreenNumber,
  getIsRacerEliminated,
  getStandingRank,
  resetRacePoints,
  resetStandings,
  CircuitResultScreen,
} from '../../../circuit-standings/index.ts'
import {
  getIsChampionBeaten,
  loadChampionGhost,
  parseGhost,
  type GhostSession,
} from '../../../ghost/index.ts'
import { findNamedRecord } from '../../../named-record/index.ts'
import { loadRaceDefinition } from '../../../race/index.ts'
import type { LoadRaceOptions, RaceState, RaceStepResult } from '../../../race/index.ts'
import { RacePhase } from '../../../race/index.ts'
import type {
  CircuitOutcome,
  GameSession,
  RaceStart,
  SessionEnd,
  SessionRace,
  SessionStep,
} from '../../types/game-session.types.ts'
import { GameMode } from '../../types/session-rules/session-rules.ts'
import type { FinishRaceOptions } from './session-flow.types.ts'
import { recordRaceTimes } from '../race-times/race-times.ts'

const GHOST_FILE_NAME = 'GHOST.GHB'

const getChanged = (session: GameSession, changes: Partial<GameSession>): GameSession =>
  Object.freeze({ ...session, ...changes })

// The first slot the runner was given a race for; a single race and a time trial run it, a circuit runs all.
const getRacerCount = (session: GameSession): number => {
  const { settings, resources } = session
  const circuit = findNamedRecord(resources.circuits.circuits, settings.circuitName)
  const codeCount = circuit?.racerCodes.length ?? 0
  // FUN_0042d730: the circuit's drivers fill the slots only when there are more racers than local players, and the
  // count never drops below the number of local players.
  const count =
    settings.localPlayerCount < settings.racerCount
      ? Math.min(settings.racerCount, codeCount)
      : settings.racerCount
  return Math.max(count, settings.localPlayerCount)
}

const getChampionGhost = (session: GameSession, race: SessionRace) => {
  const path = `GAMEDATA\\${race.folder}\\${GHOST_FILE_NAME}`
  return session.resources.archive.getFilePaths().includes(path)
    ? parseGhost(session.resources.archive.readFile(path), race.isMirrored)
    : null
}

// What the session hands the race loader; the session replay records it to load the same race again.
export const getRaceLoadOptions = (
  session: GameSession,
  race: SessionRace,
  ghost: GhostSession | null
): LoadRaceOptions => {
  const { settings } = session
  const circuit = findNamedRecord(session.resources.circuits.circuits, settings.circuitName)
  return {
    raceFolder: race.folder,
    racerCount: getRacerCount(session),
    localPlayerCount: settings.localPlayerCount,
    raceModeFlags: settings.raceModeFlags,
    randomPosition: session.randomPosition,
    playerCars: settings.playerCars,
    playerSavedCars: settings.playerSavedCars,
    ...(circuit === null ? {} : { racerCodes: circuit.racerCodes }),
    isMirrored: race.isMirrored,
    multiplayerLapCount: settings.multiplayerLapCount,
    isPointsRecordPresent: session.standings !== null,
    // CircuitRunner_PlayCircuit hands every race the same record (race +0x18): its totals and countdown carry over.
    ...(session.standings === null
      ? {}
      : {
          pointsRecord: Object.freeze({
            totalPoints: session.standings.totals,
            racePoints: session.standings.racePoints,
            tickerMilliseconds: session.pointsTickerMilliseconds,
          }),
        }),
    playerNames: settings.playerNames,
    ghost,
  }
}

const getRaceStart = (session: GameSession, race: SessionRace): RaceStart => {
  const { settings, resources } = session
  const ghost: GhostSession | null =
    session.ghost === null
      ? null
      : loadChampionGhost(session.ghost, getChampionGhost(session, race))
  const definition = loadRaceDefinition(
    resources.jam,
    resources.executable,
    getRaceLoadOptions(session, race, ghost)
  )
  return Object.freeze({
    kind: 'race',
    session: getChanged(session, { ghost }),
    race,
    definition: Object.freeze({
      ...definition,
      isCountdownSkipped: settings.isCountdownSkipped,
    }),
  })
}

// The first human racer of the race: racer 0 whenever there is a local player (the front end puts the players in the
// first slots).
const FIRST_HUMAN_RACER_INDEX = 0

// The end of CircuitRunner_PlayCircuit 0x0041ef40..: the first human's rank in the points picks the result screen.
export const getCircuitOutcome = (session: GameSession): CircuitOutcome | null => {
  if (session.standings === null) return null
  const racerIndex = FIRST_HUMAN_RACER_INDEX
  const rank = getStandingRank(session.standings, racerIndex)
  return Object.freeze({
    resultScreen: getCircuitResultScreenNumber(getCircuitResultScreen(rank)),
    rank,
    racerIndex,
  })
}

const getEnded = (session: GameSession, resultScreen: number | null): SessionEnd =>
  Object.freeze({
    kind: 'finished',
    session: getChanged(session, {
      isFinished: true,
      resultScreen: resultScreen ?? session.resultScreen,
    }),
  })

// CircuitRunner_PlayCircuit 0x0041ed80, one turn of its loop `while (i < 4 || restart requested)`: a restart request
// (flag 0x20) puts the runner back at race 0 with empty standings; a slot without a race is passed over; a lone
// player who has fewer than `10 · i` points ends the circuit on the "no place" screen; the loop ends after the fourth
// slot with the screen of the first human's rank. Unless the player left (flag 0x08), the next race starts.
const getCircuitStep = (start: GameSession): SessionStep => {
  const session = start.isRestartRequested
    ? getChanged(start, { raceIndex: 0, isRestartRequested: false, standings: resetStandings() })
    : start
  if (session.isAborted || session.settings.mode !== GameMode.CIRCUIT)
    return getEnded(session, null)
  if (session.raceIndex >= CIRCUIT_RACE_COUNT) {
    return getEnded(session, getCircuitOutcome(session)?.resultScreen ?? null)
  }
  const race = session.races[session.raceIndex] ?? null
  if (race === null)
    return getCircuitStep(getChanged(session, { raceIndex: session.raceIndex + 1 }))
  if (
    session.standings !== null &&
    getIsRacerEliminated(session.standings, session.settings.localPlayerCount, session.raceIndex)
  ) {
    return getEnded(session, getCircuitResultScreenNumber(CircuitResultScreen.NO_PLACE))
  }
  return getRaceStart(session, race)
}

// RaceSession_Play 0x0042c330: a circuit goes through the circuit runner; any other mode runs its one race (slot 0)
// once, unless the player left.
export const startNextRace = (session: GameSession): SessionStep => {
  if (session.isFinished) return Object.freeze({ kind: 'finished', session })
  if (session.settings.mode === GameMode.CIRCUIT) return getCircuitStep(session)
  const race = session.races[0] ?? null
  if (race === null || session.isAborted || session.raceIndex > 0) return getEnded(session, null)
  return getRaceStart(session, race)
}

// Race_UpdateState1 0x004349a0 clears the race's points when the countdown starts; Race_UpdateState3 and 4 give a
// racer its points as it is placed (0x004402c0 with the number of racers placed before it).
export const recordRaceStep = (session: GameSession, step: RaceStepResult): GameSession => {
  const { standings } = session
  if (standings === null) return session
  const updated = step.events.reduce((current, event) => {
    if (event.type === 'race.phase_changed' && event.to === RacePhase.COUNTDOWN) {
      return resetRacePoints(current)
    }
    if (event.type === 'race.racer_finished') {
      return awardPlacePoints(current, event.racerIndex, event.place - 1)
    }
    return current
  }, standings)
  return updated === standings ? session : getChanged(session, { standings: updated })
}

const getTimesWithRecord = (session: GameSession, raceState: RaceState) =>
  session.raceTimes.map((record, slot) =>
    slot === session.raceIndex
      ? recordRaceTimes(record, raceState.racerSet.racers, raceState.playerRacerIndices)
      : record
  )

// The end of Race_RunLoop 0x00432540 and of one turn of PlayCircuit: the times go into the slot's record, a race
// with a ghost marks the times for the front end and, when the best run beat the champion, the win; the slot counter
// and the random table cursor move on. The race may have ended by the loop's own account or because the player left
// through the menu (`isAborted`).
export const finishRace = (
  session: GameSession,
  raceState: RaceState,
  options: FinishRaceOptions = {}
): GameSession =>
  getChanged(session, {
    raceTimes: Object.freeze(getTimesWithRecord(session, raceState)),
    ghost: raceState.ghost,
    isTimeRecordPending: session.isTimeRecordPending || raceState.ghost !== null,
    isChampionBeaten:
      session.isChampionBeaten ||
      (raceState.ghost !== null && getIsChampionBeaten(raceState.ghost)),
    raceIndex: session.raceIndex + 1,
    randomPosition: raceState.racerSet.randomPosition,
    isAborted: session.isAborted || (options.isAborted ?? false),
    pointsTickerMilliseconds:
      raceState.pointsRecord?.tickerMilliseconds ?? session.pointsTickerMilliseconds,
  })

// The pause menu's "restart" in a time trial or a single race, and in the first race of a circuit (FUN_00436160 with
// FUN_004362e0): the times so far are recorded (FUN_0043a6e0 → FUN_0043beb0), the standings of a circuit are cleared
// (FUN_00440860) and the same race starts over. Not exact: the original resets the racers in place
// (FUN_0043a780) where this loads the race again from its definition with the current random table cursor.
export const restartRace = (session: GameSession, raceState: RaceState): RaceStart | SessionEnd => {
  const recorded = getChanged(session, {
    raceTimes: Object.freeze(getTimesWithRecord(session, raceState)),
    ghost: raceState.ghost,
    isTimeRecordPending: session.isTimeRecordPending || raceState.ghost !== null,
    randomPosition: raceState.racerSet.randomPosition,
    standings: session.standings === null ? null : resetStandings(),
  })
  const race = recorded.races[recorded.raceIndex] ?? null
  return race === null ? getEnded(recorded, null) : getRaceStart(recorded, race)
}

// The pause menu in a circuit's later races (FUN_00436160 with `+0x3360 == 1`, not the first race): the race ends and
// the runner starts the circuit over (settings flag 0x20).
export const requestCircuitRestart = (session: GameSession): GameSession =>
  getChanged(session, { isRestartRequested: true })

// The pause menu's "quit" (`+0x3360 == 2`, settings flag 0x08): the runner stops without a result.
export const abortSession = (session: GameSession): GameSession =>
  getChanged(session, { isAborted: true })

// The runner's flag 0x40: the first slot of the circuit, where a restart only resets the standings.
export const getIsFirstRace = (session: GameSession): boolean => session.raceIndex === 0
