import RaceHudOverlay from '../../components/race-hud-overlay/race-hud-overlay.tsx'
import RacePanel from '../../components/race-panel/race-panel.tsx'
import {
  RACE_STAGE_SIZE,
  useRaceController,
} from '../../controller/race-controller/race-controller.ts'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import FrontEndView from '../front-end-view/front-end-view.tsx'

// Race mode: the game's menus choose the race, then it is played live. The stage is 4:3, the menus or the race
// drawn in it and the HUD over the race.
const RaceView = () => {
  const race = useRaceController()
  return (
    <>
      <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-700 p-4">
        <h1 className="text-lg font-bold">LEGO Racers</h1>
        <RacePanel
          status={race.status}
          errorMessage={race.errorMessage}
          isDevelopmentFilesAvailable={race.isDevelopmentFilesAvailable}
          onDevelopmentGameRequested={race.onDevelopmentGameRequested}
          onGameFilesChosen={race.onGameFilesChosen}
          onRaceStopped={race.onRaceStopped}
        />
      </aside>
      <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-black">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ width: RACE_STAGE_SIZE.width, height: RACE_STAGE_SIZE.height }}
        >
          {race.status === RaceStatus.MENU && race.gameJam !== null ? (
            <FrontEndView
              jam={race.gameJam}
              readTune={race.readTune}
              firstScreenId={race.menuScreenId}
              standingRows={race.standingRows}
              width={RACE_STAGE_SIZE.width}
              height={RACE_STAGE_SIZE.height}
              onRaceRequested={race.onRaceRequested}
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
