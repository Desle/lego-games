import {
  FrontEndScreen,
  getSessionSettings,
  getStandingRows,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndRaceRequest } from '@lego-games/lego-racers/front-end'
import { advanceFrameClock, createFrameClock } from '@lego-games/lego-racers/frame-clock'
import {
  createGameSession,
  finishRace,
  loadGameResources,
  recordRaceStep,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import type { GameResources, GameSession } from '@lego-games/lego-racers/game-session'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  stepRace,
} from '@lego-games/lego-racers/race'
import type { RaceState } from '@lego-games/lego-racers/race'
import { getRacerControls } from '@lego-games/lego-racers/race-input'
import {
  createRacePresentation,
  getEffectViews,
  getRacerPoses,
  stepRacePresentation,
} from '@lego-games/lego-racers/race-presentation'
import type { RacePresentation } from '@lego-games/lego-racers/race-presentation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEVELOPMENT_GAME_FILE_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { createHudImageUrls, getHudContext } from '../../services/hud-resources/hud-resources.ts'
import { getDevelopmentJam } from '../../services/jam-file/jam-file.ts'
import { createRaceAudioPlayer } from '../../services/race-audio-player/race-audio-player.ts'
import { loadRaceAssets } from '../../services/race-assets/race-assets.ts'
import type { LoadedGameFiles, RaceAssets } from '../../services/race-assets/race-assets.types.ts'
import { createRaceInputSource } from '../../services/race-input-source/race-input-source.ts'
import { createRaceViewport } from '../../services/race-viewport/race-viewport.ts'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import type { RaceController, RaceScreen } from './race-controller.types.ts'

// The race is drawn at 4:3 and the HUD is laid out for the same size.
export const RACE_STAGE_SIZE = Object.freeze({ width: 800, height: 600 })
const EXECUTABLE_NAME = 'LEGORacers.exe'
const JAM_NAME = 'LEGO.JAM'

const INITIAL_SCREEN: RaceScreen = Object.freeze({
  status: RaceStatus.IDLE,
  errorMessage: null,
  phase: null,
  hudCommands: [],
  hudImageUrls: new Map(),
  hudFonts: null,
  lapCount: 0,
  menuScreenId: FrontEndScreen.MAIN_MENU,
  standingRows: [],
})

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const fetchBytes = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(await response.text())
  return new Uint8Array(await response.arrayBuffer())
}

// The dev server hands out LEGORacers.exe and the tunes next to the local LEGO.JAM; a race fetches the tunes its music
// list names (every track has its own list).
const getDevelopmentGameFiles = async (): Promise<LoadedGameFiles> => {
  const jam = await getDevelopmentJam()
  const executable = await fetchBytes(`${DEVELOPMENT_GAME_FILE_ROUTE}/${EXECUTABLE_NAME}`)
  return {
    jam,
    files: { executable, tunes: new Map() },
    readTune: (name) => fetchBytes(`${DEVELOPMENT_GAME_FILE_ROUTE}/${name}`).catch(() => null),
  }
}

// The race's assets with the tunes of its music list (`LEGOMSC`) added; a tune that cannot be read stays silent.
const loadRaceTunes = async (
  assets: RaceAssets,
  gameFiles: LoadedGameFiles
): Promise<RaceAssets> => {
  const tunes = new Map(assets.tunes)
  await Promise.all(
    assets.musicNames
      .map((name) => name.toLowerCase())
      .filter((name) => !tunes.has(name))
      .map(async (name) => {
        const bytes = await gameFiles.readTune(name)
        if (bytes !== null) tunes.set(name, bytes)
      })
  )
  return { ...assets, tunes }
}

const getChosenGameFiles = async (files: readonly File[]): Promise<LoadedGameFiles> => {
  const find = (name: string) =>
    files.find((file) => file.name.toLowerCase() === name.toLowerCase())
  const jamFile = find(JAM_NAME)
  const executableFile = find(EXECUTABLE_NAME)
  if (jamFile === undefined || executableFile === undefined) {
    throw new Error(`Choose ${JAM_NAME} and ${EXECUTABLE_NAME} (and the .tun music files).`)
  }
  const tunes = await Promise.all(
    files
      .filter((file) => file.name.toLowerCase().endsWith('.tun'))
      .map(
        async (file) => [file.name.toLowerCase(), new Uint8Array(await file.arrayBuffer())] as const
      )
  )
  return {
    jam: new Uint8Array(await jamFile.arrayBuffer()),
    files: {
      executable: new Uint8Array(await executableFile.arrayBuffer()),
      tunes: new Map(tunes),
    },
    readTune: (name) => Promise.resolve(new Map(tunes).get(name.toLowerCase()) ?? null),
  }
}

// Runs a race live: the original's frame clock feeds `stepRace`, the presentation module turns each step into the
// camera, HUD, music and sounds, and the services draw and play them.
export const useRaceController = (): RaceController => {
  const containerReference = useRef<HTMLDivElement | null>(null)
  const [screen, setScreen] = useState<RaceScreen>(INITIAL_SCREEN)
  const [assets, setAssets] = useState<RaceAssets | null>(null)
  const [gameFiles, setGameFiles] = useState<LoadedGameFiles | null>(null)
  const [gameResources, setGameResources] = useState<GameResources | null>(null)
  // The session the race that runs belongs to: a circuit's four races, or the one race of a single race.
  const sessionReference = useRef<GameSession | null>(null)
  const advanceReference = useRef<(session: GameSession, racerCount: number) => void>(
    () => undefined
  )

  // The game's files are opened first: the front end shows its menus from them, and they stay open for every race.
  const openGame = useCallback((getFiles: () => Promise<LoadedGameFiles>) => {
    setAssets(null)
    setScreen({ ...INITIAL_SCREEN, status: RaceStatus.LOADING })
    getFiles()
      .then((files) => {
        setGameResources(loadGameResources(files.jam, files.files.executable))
        setGameFiles(files)
        setScreen({ ...INITIAL_SCREEN, status: RaceStatus.MENU })
      })
      .catch((error: unknown) =>
        setScreen({
          ...INITIAL_SCREEN,
          status: RaceStatus.FAILED,
          errorMessage: getErrorMessage(error),
        })
      )
  }, [])

  const showFailure = useCallback(
    (error: unknown) =>
      setScreen({
        ...INITIAL_SCREEN,
        status: RaceStatus.FAILED,
        errorMessage: getErrorMessage(error),
      }),
    []
  )

  // The session has ended: the menus open on the screen it names (2, the main menu, or a circuit's result screen).
  const returnToMenu = useCallback((session: GameSession, racerCount: number) => {
    sessionReference.current = null
    setAssets(null)
    setScreen({
      ...INITIAL_SCREEN,
      status: RaceStatus.MENU,
      menuScreenId: session.resultScreen,
      standingRows: getStandingRows(session, racerCount),
    })
  }, [])

  // RaceSession_Play 0x0042c330: the session says which race is next, or that it is over.
  const advanceSession = useCallback(
    (session: GameSession, racerCount: number) => {
      if (gameFiles === null) return
      const next = startNextRace(session)
      if (next.kind === 'finished') {
        returnToMenu(next.session, racerCount)
        return
      }
      sessionReference.current = next.session
      setScreen({ ...INITIAL_SCREEN, status: RaceStatus.LOADING })
      // Lets the loading state paint before the synchronous load.
      window.setTimeout(() => {
        try {
          const loaded = loadRaceAssets(
            gameFiles.jam,
            gameFiles.files,
            { raceFolder: next.race.folder },
            next.definition
          )
          loadRaceTunes(loaded, gameFiles).then(setAssets).catch(showFailure)
        } catch (error) {
          showFailure(error)
        }
      }, 0)
    },
    [gameFiles, returnToMenu, showFailure]
  )
  advanceReference.current = advanceSession

  // The menus chose a race, a circuit or a time trial: the game session plays it.
  const startRace = useCallback(
    (request: FrontEndRaceRequest) => {
      if (gameResources === null) return
      try {
        const session = createGameSession(
          gameResources,
          getSessionSettings(gameResources, request, 0)
        )
        advanceSession(session, request.racerCount)
      } catch (error) {
        showFailure(error)
      }
    },
    [advanceSession, gameResources, showFailure]
  )

  useEffect(() => {
    const container = containerReference.current
    if (assets === null || container === null) return undefined
    const viewport = createRaceViewport(container, assets, RACE_STAGE_SIZE)
    const input = createRaceInputSource()
    const audio = createRaceAudioPlayer(assets)
    const hudContext = getHudContext(assets, RACE_STAGE_SIZE)
    const hudImageUrls = createHudImageUrls(assets.hudImages)
    const resumeAudio = () => audio.resume()
    window.addEventListener('keydown', resumeAudio)
    let raceState: RaceState = createRace(assets.definition)
    const started = createRacePresentation(raceState, assets.musicNames.length)
    let presentation: RacePresentation = started.presentation
    let clock = createFrameClock()
    let animationFrame = 0
    audio.playMusic(started.music)
    setScreen({
      ...INITIAL_SCREEN,
      status: RaceStatus.RUNNING,
      phase: raceState.phase,
      hudImageUrls,
      hudFonts: assets.hudFonts,
      lapCount: raceState.lapCount,
    })

    const onFrame = (time: number) => {
      animationFrame = requestAnimationFrame(onFrame)
      const advance = advanceFrameClock(clock, time)
      clock = advance.clock
      if (advance.frameMilliseconds !== null && raceState.isRunning) {
        const controls = getRacerControls(input.read())
        const step = stepRace(
          raceState,
          { controls: [controls], contacts: NO_RACE_CONTACTS },
          advance.frameMilliseconds
        )
        raceState = step.raceState
        if (sessionReference.current !== null) {
          sessionReference.current = recordRaceStep(sessionReference.current, step)
        }
        const frame = stepRacePresentation(
          presentation,
          step,
          { ...IDLE_RACER_CONTROLS, ...controls },
          advance.frameMilliseconds,
          hudContext
        )
        presentation = frame.presentation
        for (const sound of frame.sounds) audio.playSound(sound)
        if (frame.music !== null) audio.playMusic(frame.music)
        viewport.update(getRacerPoses(raceState), frame.cameraView, getEffectViews(raceState))
        viewport.showHazards(raceState.trackLogic.worlds.track, [
          raceState.trackLogic.emitters.common,
          raceState.trackLogic.emitters.track,
        ])
        viewport.animate(advance.frameMilliseconds)
        setScreen((previous) => ({
          ...previous,
          phase: raceState.phase,
          hudCommands: frame.hudFrame?.commands ?? [],
        }))
        if (!raceState.isRunning && sessionReference.current !== null) {
          // finishRace and the next turn of the session's loop (Race_RunLoop 0x00432540 ends, PlayCircuit continues).
          const finished = finishRace(sessionReference.current, raceState)
          sessionReference.current = null
          cancelAnimationFrame(animationFrame)
          advanceReference.current(finished, raceState.racerSet.racers.length)
          return
        }
      }
      viewport.render()
    }
    animationFrame = requestAnimationFrame(onFrame)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', resumeAudio)
      input.dispose()
      audio.dispose()
      viewport.dispose()
    }
  }, [assets])

  return {
    ...screen,
    containerReference,
    isDevelopmentFilesAvailable: import.meta.env.DEV,
    gameJam: screen.status === RaceStatus.MENU ? (gameFiles?.jam ?? null) : null,
    readTune: screen.status === RaceStatus.MENU ? (gameFiles?.readTune ?? null) : null,
    // A production build replaces DEV with false and drops the development fetches entirely.
    onDevelopmentGameRequested: import.meta.env.DEV
      ? () => openGame(getDevelopmentGameFiles)
      : () => undefined,
    onGameFilesChosen: (files) => openGame(() => getChosenGameFiles(files)),
    onRaceRequested: startRace,
    onGameClosed: () => {
      setAssets(null)
      setGameFiles(null)
      setScreen(INITIAL_SCREEN)
    },
    onRaceStopped: () => {
      sessionReference.current = null
      setAssets(null)
      setScreen({
        ...INITIAL_SCREEN,
        status: gameFiles === null ? RaceStatus.IDLE : RaceStatus.MENU,
      })
    },
  }
}
