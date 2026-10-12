import {
  FrontEndScreen,
  getSessionSettings,
  NO_FRONT_END_MEMORY,
  getStandingRows,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndDemonstrationRequest,
  FrontEndMemory,
  FrontEndRaceRequest,
} from '@lego-games/lego-racers/front-end'
import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import { parseSaveFile, serializeSaveFile } from '@lego-games/lego-racers/save-data'
import type { SaveFile } from '@lego-games/lego-racers/save-data'
import { advanceFrameClock, createFrameClock } from '@lego-games/lego-racers/frame-clock'
import {
  abortSession,
  applySessionOutcomeToSave,
  createDemonstrationSettings,
  createGameSession,
  finishRace,
  getIsFirstRace,
  loadGameResources,
  recordRaceStep,
  requestCircuitRestart,
  restartRace,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import type {
  GameResources,
  GameSession,
  RaceStart,
  SessionEnd,
} from '@lego-games/lego-racers/game-session'
import {
  createRace,
  getRaceStateWithGrants,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  PauseMenuMode,
  RaceExit,
  stepRace,
} from '@lego-games/lego-racers/race'
import type { RaceState } from '@lego-games/lego-racers/race'
import { getRacerControls } from '@lego-games/lego-racers/race-input'
import {
  createRacePresentation,
  getEffectViews,
  getGhostCars,
  getPauseMenuCommands,
  getRacerPoses,
  stepRacePresentation,
} from '@lego-games/lego-racers/race-presentation'
import type { RacePresentation } from '@lego-games/lego-racers/race-presentation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEVELOPMENT_GAME_FILE_ROUTE,
  DEVELOPMENT_JAM_ROUTE,
} from '../../../../shared/development-jam/development-jam-route.ts'
import { watchHudPictures } from '../../services/hud-pictures/hud-pictures.ts'
import { createHudImageUrls, getHudContext } from '../../services/hud-resources/hud-resources.ts'
import { getDevelopmentJam } from '../../services/jam-file/jam-file.ts'
import { createRaceAudioPlayer } from '../../services/race-audio-player/race-audio-player.ts'
import { loadRaceAssets } from '../../services/race-assets/race-assets.ts'
import type { LoadedGameFiles, RaceAssets } from '../../services/race-assets/race-assets.types.ts'
import { createDevelopmentPowerUpSource } from '../../services/development-power-up-source/development-power-up-source.ts'
import {
  getIsDirectoryPickerAvailable,
  getNeededGameFiles,
  pickGameFolderFiles,
} from '../../services/game-folder/game-folder.ts'
import { createIndexedDbSaveStorage } from '../../services/indexed-db-save-storage/indexed-db-save-storage.ts'
import { createRaceMenuInputSource } from '../../services/race-menu-input-source/race-menu-input-source.ts'
import {
  createRaceRecording,
  getIsRaceRecordingRequested,
} from '../../services/race-recording/race-recording.ts'
import type { RaceRecording } from '../../services/race-recording/race-recording.types.ts'
import { createRaceInputSource } from '../../services/race-input-source/race-input-source.ts'
import { useRaceDisplayController } from '../race-display-controller/race-display-controller.ts'
import { createRaceViewport } from '../../services/race-viewport/race-viewport.ts'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import type { RaceController, RaceScreen } from './race-controller.types.ts'

// The race is drawn at 4:3 and the HUD is laid out for the same size.
export const RACE_STAGE_SIZE = Object.freeze({ width: 800, height: 600 })
// The save slot the game plays on (the original loads two, 0x00443520, and starts from the first) and the file the defaults
// come from (0x004bef94).
const SAVE_SLOT = 0
const DEFAULT_SAVE_PATH = 'MENUDATA\\DEFAULT.LRS'
const EXECUTABLE_NAME = 'LEGORacers.exe'
const JAM_NAME = 'LEGO.JAM'

const INITIAL_SCREEN: RaceScreen = Object.freeze({
  status: RaceStatus.IDLE,
  errorMessage: null,
  phase: null,
  hudCommands: [],
  hudImageUrls: new Map(),
  hudImageScales: new Map(),
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
  const display = useRaceDisplayController()
  const displayReference = useRef(display)
  displayReference.current = display
  const displayChangedReference = useRef<() => void>(() => undefined)
  const [screen, setScreen] = useState<RaceScreen>(INITIAL_SCREEN)
  const [assets, setAssets] = useState<RaceAssets | null>(null)
  const [gameFiles, setGameFiles] = useState<LoadedGameFiles | null>(null)
  const [gameResources, setGameResources] = useState<GameResources | null>(null)
  // What the menus keep between two visits: the car and driver the player made, and the shared random position.
  const memoryReference = useRef<FrontEndMemory>(NO_FRONT_END_MEMORY)
  // The save slots of the browser (IndexedDB); the game runs without them when the browser has none.
  const saveStorage = useMemo(() => createIndexedDbSaveStorage(), [])
  const randomTable = useMemo(
    () => (gameFiles === null ? null : loadRandomTable(gameFiles.files.executable)),
    [gameFiles]
  )
  // The session the race that runs belongs to: a circuit's four races, or the one race of a single race.
  const sessionReference = useRef<GameSession | null>(null)
  // The recording of the race that is loading or running (null when nothing is recorded).
  const recordingReference = useRef<RaceRecording | null>(null)
  const advanceReference = useRef<(session: GameSession, racerCount: number) => void>(
    () => undefined
  )

  const persistSave = useCallback(
    (saveFile: SaveFile) =>
      void saveStorage.writeSlot(SAVE_SLOT, serializeSaveFile(saveFile)).catch(() => undefined),
    [saveStorage]
  )

  const loadSaveFile = useCallback(
    async (resources: GameResources): Promise<SaveFile> => {
      try {
        const bytes = await saveStorage.readSlot(SAVE_SLOT)
        if (bytes !== null) return parseSaveFile(bytes)
      } catch {
        // A save that does not parse is replaced by the defaults, as a missing one is (0x00443420).
      }
      const created = parseSaveFile(resources.archive.readFile(DEFAULT_SAVE_PATH))
      await saveStorage.writeSlot(SAVE_SLOT, serializeSaveFile(created))
      return created
    },
    [saveStorage]
  )

  // The game's files are opened first: the front end shows its menus from them, and they stay open for every race.
  const openGame = useCallback(
    (getFiles: () => Promise<LoadedGameFiles>) => {
      setAssets(null)
      setScreen({ ...INITIAL_SCREEN, status: RaceStatus.LOADING })
      getFiles()
        .then(async (files) => {
          const resources = loadGameResources(files.jam, files.files.executable)
          memoryReference.current = {
            ...NO_FRONT_END_MEMORY,
            saveFile: await loadSaveFile(resources),
          }
          setGameResources(resources)
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
    },
    [loadSaveFile]
  )

  // The dev server opens the game on its own when it serves the files; a production build drops this.
  const hasTriedDevelopmentGameReference = useRef(false)
  useEffect(() => {
    if (!import.meta.env.DEV || hasTriedDevelopmentGameReference.current) return
    hasTriedDevelopmentGameReference.current = true
    void fetch(DEVELOPMENT_JAM_ROUTE, { method: 'HEAD' })
      .then((response) => {
        if (response.ok) openGame(getDevelopmentGameFiles)
      })
      .catch(() => undefined)
  }, [openGame])

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
  const returnToMenu = useCallback(
    (session: GameSession, racerCount: number) => {
      const memory = memoryReference.current
      // The best times, the beaten champion, the circuit's place, trophy and unlock go into the save (0x0042e490,
      // 0x0042e680, 0x004767b0) and the save is written.
      const outcome =
        memory.saveFile === null
          ? null
          : applySessionOutcomeToSave(session, memory.saveFile, memory.racerIndex)
      memoryReference.current = {
        ...memory,
        randomPosition: session.randomPosition,
        saveFile: outcome?.saveFile ?? memory.saveFile,
      }
      if (outcome !== null && outcome.saveFile !== memory.saveFile) persistSave(outcome.saveFile)
      sessionReference.current = null
      setAssets(null)
      setScreen({
        ...INITIAL_SCREEN,
        status: RaceStatus.MENU,
        menuScreenId: outcome?.resultScreen ?? session.resultScreen,
        standingRows: getStandingRows(session, racerCount),
      })
    },
    [persistSave]
  )

  // The race the session started is loaded and run.
  const beginRace = useCallback(
    (next: RaceStart) => {
      if (gameFiles === null) return
      sessionReference.current = next.session
      recordingReference.current = getIsRaceRecordingRequested(window.location.search)
        ? createRaceRecording(next)
        : null
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
    [gameFiles, showFailure]
  )

  // RaceSession_Play 0x0042c330: the session says which race is next, or that it is over.
  const advanceSession = useCallback(
    (session: GameSession, racerCount: number) => {
      const next = startNextRace(session)
      if (next.kind === 'finished') returnToMenu(next.session, racerCount)
      else beginRace(next)
    },
    [beginRace, returnToMenu]
  )
  advanceReference.current = advanceSession

  // The pause menu's restart (0x00436160 with 0x004362e0): the same race starts over, or the whole circuit does.
  const restartReference = useRef<(session: GameSession, raceState: RaceState) => void>(
    () => undefined
  )
  restartReference.current = (session: GameSession, raceState: RaceState) => {
    const racerCount = raceState.racerSet.racers.length
    if (session.standings !== null && !getIsFirstRace(session)) {
      advanceSession(finishRace(requestCircuitRestart(session), raceState), racerCount)
      return
    }
    const restarted: RaceStart | SessionEnd = restartRace(session, raceState)
    if (restarted.kind === 'race') beginRace(restarted)
    else returnToMenu(restarted.session, racerCount)
  }

  // The menus chose a race, a circuit or a time trial: the game session plays it.
  const startRace = useCallback(
    (request: FrontEndRaceRequest) => {
      if (gameResources === null) return
      memoryReference.current = {
        ...memoryReference.current,
        playerCar: request.playerCar,
        randomPosition: request.randomPosition,
      }
      try {
        const session = createGameSession(
          gameResources,
          getSessionSettings(gameResources, request, request.randomPosition)
        )
        advanceSession(session, request.racerCount)
      } catch (error) {
        showFailure(error)
      }
    },
    [advanceSession, gameResources, showFailure]
  )

  // The main menu's idle timer ran out: the demonstration plays (the computer drives racer 0; any key ends it).
  const startDemonstration = useCallback(
    (request: FrontEndDemonstrationRequest) => {
      if (gameResources === null) return
      try {
        const settings = createDemonstrationSettings(gameResources, request)
        advanceSession(createGameSession(gameResources, settings), settings.racerCount)
      } catch (error) {
        showFailure(error)
      }
    },
    [advanceSession, gameResources, showFailure]
  )

  useEffect(() => {
    const container = containerReference.current
    if (assets === null || container === null) return undefined
    const recording = recordingReference.current
    const viewport = createRaceViewport(
      container,
      assets,
      displayReference.current.stageSize,
      displayReference.current.pixelRatio === 1 ? null : displayReference.current.pixelRatio
    )
    const input = createRaceInputSource()
    const menuInput = createRaceMenuInputSource()
    const developmentPowerUps = import.meta.env.DEV ? createDevelopmentPowerUpSource() : null
    const audio = createRaceAudioPlayer(assets)
    let hudContext = getHudContext(assets, displayReference.current.hudDesignSize)
    displayChangedReference.current = () => {
      viewport.resize(displayReference.current.stageSize)
      hudContext = getHudContext(assets, displayReference.current.hudDesignSize)
    }
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
      hudImageScales: new Map(),
      hudFonts: assets.hudFonts,
      lapCount: raceState.lapCount,
    })

    watchHudPictures(assets, (pictures) =>
      setScreen((previous) => ({
        ...previous,
        hudImageUrls: pictures.imageUrls,
        hudImageScales: pictures.imageScales,
        hudFonts: pictures.fonts,
      }))
    )

    const onFrame = (time: number) => {
      animationFrame = requestAnimationFrame(onFrame)
      const advance = advanceFrameClock(clock, time)
      clock = advance.clock
      if (advance.frameMilliseconds !== null && raceState.isRunning) {
        const inputSnapshot = input.read()
        const controls = getRacerControls(inputSnapshot)
        const powerUpRequest = developmentPowerUps?.take() ?? null
        const menuKeys = menuInput.read()
        recording?.addFrame({
          milliseconds: advance.frameMilliseconds,
          input: inputSnapshot,
          menu: menuKeys,
          grant: powerUpRequest,
        })
        const step = stepRace(
          powerUpRequest === null
            ? raceState
            : getRaceStateWithGrants(raceState, [
                { racer: 0, kind: powerUpRequest.kind, level: powerUpRequest.level },
              ]),
          { controls: [controls], contacts: NO_RACE_CONTACTS, menu: menuKeys },
          advance.frameMilliseconds
        )
        const ghostStep = getGhostCars(step.raceState)
        raceState = ghostStep.raceState
        if (sessionReference.current !== null) {
          sessionReference.current = recordRaceStep(sessionReference.current, step)
        }
        const isMenuOpen = raceState.pauseMenu.mode !== PauseMenuMode.NONE
        const frame = stepRacePresentation(
          presentation,
          step,
          { ...IDLE_RACER_CONTROLS, ...controls },
          isMenuOpen ? 0 : advance.frameMilliseconds,
          hudContext
        )
        presentation = frame.presentation
        for (const sound of frame.sounds) audio.playSound(sound)
        audio.setEngineLoops(frame.engineLoops, frame.cameraView.position)
        if (frame.music !== null) audio.playMusic(frame.music)
        viewport.update(
          getRacerPoses(raceState),
          frame.cameraView,
          getEffectViews(raceState),
          frame.warpView,
          ghostStep.cars,
          frame.screenFades,
          frame.fieldOfViewDegrees
        )
        viewport.showHazards(raceState.trackLogic.worlds, [
          raceState.racerSet.emitters.common,
          raceState.racerSet.emitters.track,
        ])
        viewport.animate(advance.frameMilliseconds)
        setScreen((previous) => ({
          ...previous,
          phase: raceState.phase,
          hudCommands: displayReference.current.getHudCommands([
            ...(frame.hudFrame?.commands ?? []),
            ...getPauseMenuCommands(raceState, hudContext),
          ]),
        }))
        if (!raceState.isRunning && sessionReference.current !== null) {
          // The loop ended (Race_RunLoop 0x00432540): the pause menu's restart and quit are answered by the session,
          // anything else finishes the race and PlayCircuit continues.
          const session = sessionReference.current
          sessionReference.current = null
          void recording?.finish()
          cancelAnimationFrame(animationFrame)
          if (raceState.exit === RaceExit.RESTART) {
            restartReference.current(session, raceState)
          } else {
            const isQuit = raceState.exit === RaceExit.QUIT
            const finished = finishRace(isQuit ? abortSession(session) : session, raceState, {
              isAborted: isQuit,
            })
            advanceReference.current(finished, raceState.racerSet.racers.length)
          }
          return
        }
      }
      viewport.render()
    }
    animationFrame = requestAnimationFrame(onFrame)
    return () => {
      void recording?.finish()
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', resumeAudio)
      input.dispose()
      menuInput.dispose()
      developmentPowerUps?.dispose()
      audio.dispose()
      viewport.dispose()
      displayChangedReference.current = () => undefined
    }
  }, [assets])

  useEffect(() => displayChangedReference.current(), [display])

  return {
    ...screen,
    display,
    containerReference,
    gameJam: screen.status === RaceStatus.MENU ? (gameFiles?.jam ?? null) : null,
    randomTable: screen.status === RaceStatus.MENU ? randomTable : null,
    menuMemory: memoryReference.current,
    readTune: screen.status === RaceStatus.MENU ? (gameFiles?.readTune ?? null) : null,
    isDirectoryPickerAvailable: getIsDirectoryPickerAvailable(),
    onGameFilesChosen: (files) => openGame(() => getChosenGameFiles(getNeededGameFiles(files))),
    onGameFolderRequested: () =>
      void pickGameFolderFiles()
        .then((files) => {
          if (files !== null) openGame(() => getChosenGameFiles(files))
        })
        .catch(showFailure),
    onRaceRequested: startRace,
    onDemonstrationRequested: startDemonstration,
    onMenuMemoryChanged: (memory) => {
      if (memory.saveFile !== null && memory.saveFile !== memoryReference.current.saveFile) {
        persistSave(memory.saveFile)
      }
      memoryReference.current = memory
    },
    onGameClosed: () => {
      setAssets(null)
      setGameFiles(null)
      memoryReference.current = NO_FRONT_END_MEMORY
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
