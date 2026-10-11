import RaceHudOverlay from '../../components/race-hud-overlay/race-hud-overlay.tsx'
import RacePanel from '../../components/race-panel/race-panel.tsx'
import {
  RACE_STAGE_SIZE,
  useRaceController,
} from '../../controller/race-controller/race-controller.ts'

// Race mode: Royal Knights Raceway played live. The stage is 4:3, the race drawn in it and the HUD over it.
const RaceView = () => {
  const race = useRaceController()
  return (
    <>
      <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-700 p-4">
        <h1 className="text-lg font-bold">LEGO Racers race</h1>
        <RacePanel
          status={race.status}
          errorMessage={race.errorMessage}
          isDevelopmentFilesAvailable={race.isDevelopmentFilesAvailable}
          onDevelopmentRaceRequested={race.onDevelopmentRaceRequested}
          onGameFilesChosen={race.onGameFilesChosen}
          onRaceStopped={race.onRaceStopped}
        />
      </aside>
      <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-black">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ width: RACE_STAGE_SIZE.width, height: RACE_STAGE_SIZE.height }}
        >
          <div ref={race.containerReference} data-testid="race-stage" />
          <RaceHudOverlay
            commands={race.hudCommands}
            imageUrls={race.hudImageUrls}
            phase={race.phase}
          />
        </div>
      </main>
    </>
  )
}

export default RaceView
