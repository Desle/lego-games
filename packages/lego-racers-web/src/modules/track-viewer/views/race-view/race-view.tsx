import { lazy, Suspense } from 'react'
import { useLetterboxScale } from '../../controller/letterbox-scale/letterbox-scale.ts'
import RaceHudOverlay from '../../components/race-hud-overlay/race-hud-overlay.tsx'
import RacePanel from '../../components/race-panel/race-panel.tsx'
import {
  RACE_STAGE_SIZE,
  useRaceController,
} from '../../controller/race-controller/race-controller.ts'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import FrontEndView from '../front-end-view/front-end-view.tsx'

// The developer tools are a separate chunk that a production build leaves out.
const DevelopmentOverlay = import.meta.env.DEV
  ? lazy(() => import('../development-overlay/development-overlay.tsx'))
  : null

// Race mode: the game's menus choose the race, then it is played live. The stage is 4:3, the menus or the race
// drawn in it and the HUD over the race.
const RaceView = () => {
  const race = useRaceController()
  const { frameReference, scale } = useLetterboxScale(RACE_STAGE_SIZE)
  const isGameShown = race.status === RaceStatus.MENU || race.status === RaceStatus.RUNNING
  const racePanel = (
    <RacePanel
      status={race.status}
      errorMessage={race.errorMessage}
      isDirectoryPickerAvailable={race.isDirectoryPickerAvailable}
      onGameFolderRequested={race.onGameFolderRequested}
      onGameFilesChosen={race.onGameFilesChosen}
    />
  )
  return (
    <>
      {DevelopmentOverlay !== null && (
        <Suspense fallback={null}>
          <DevelopmentOverlay
            isRaceRunning={race.status === RaceStatus.RUNNING}
            onRaceStopped={race.onRaceStopped}
          />
        </Suspense>
      )}
      {!isGameShown && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black p-6 text-slate-100">
          <h1 className="text-3xl font-bold text-amber-400">LEGO Racers</h1>
          <div className="w-full max-w-md overflow-y-auto">{racePanel}</div>
        </div>
      )}
      <main ref={frameReference} className="fixed inset-0 overflow-hidden bg-black">
        <div
          className="absolute top-1/2 left-1/2 overflow-hidden"
          style={{
            width: RACE_STAGE_SIZE.width,
            height: RACE_STAGE_SIZE.height,
            transform: `translate(-50%, -50%) scale(${String(scale)})`,
          }}
        >
          {race.status === RaceStatus.MENU && race.gameJam !== null && race.randomTable !== null ? (
            <FrontEndView
              jam={race.gameJam}
              randomTable={race.randomTable}
              memory={race.menuMemory}
              readTune={race.readTune}
              firstScreenId={race.menuScreenId}
              standingRows={race.standingRows}
              width={RACE_STAGE_SIZE.width}
              height={RACE_STAGE_SIZE.height}
              onMenuMemoryChanged={race.onMenuMemoryChanged}
              onRaceRequested={race.onRaceRequested}
              onDemonstrationRequested={race.onDemonstrationRequested}
              onQuit={race.onGameClosed}
            />
          ) : (
            <div ref={race.containerReference} data-testid="race-stage" />
          )}
          <RaceHudOverlay
            commands={race.hudCommands}
            imageUrls={race.hudImageUrls}
            fonts={race.hudFonts}
            width={RACE_STAGE_SIZE.width}
            height={RACE_STAGE_SIZE.height}
            phase={race.phase}
          />
        </div>
      </main>
    </>
  )
}

export default RaceView
