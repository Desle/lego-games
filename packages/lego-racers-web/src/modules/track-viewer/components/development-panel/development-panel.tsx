import type { DevelopmentPanelProps } from './development-panel.types.ts'

// The developer tools in one small panel: the track viewer, leaving a race, the session recording and the power-up keys.
const DevelopmentPanel = ({
  isRaceRunning,
  onTrackViewerOpened,
  onRaceStopped,
  onRecordingDownloaded,
  onOverlayClosed,
}: DevelopmentPanelProps) => (
  <section className="fixed top-2 right-2 z-30 flex w-60 flex-col gap-2 rounded bg-slate-900/90 p-3 text-xs text-slate-100">
    <h2 className="font-semibold">Developer tools (~ closes)</h2>
    <button
      type="button"
      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
      onClick={onTrackViewerOpened}
    >
      Track viewer
    </button>
    {isRaceRunning && (
      <button
        type="button"
        className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
        onClick={onRaceStopped}
      >
        Stop the race (back to the menus)
      </button>
    )}
    <button
      type="button"
      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
      onClick={onRecordingDownloaded}
    >
      Download the last session recording (F9)
    </button>
    <p className="text-slate-400">
      Power-ups for the player: 1 cannon, 2 shield, 3 turbo, 4 oil; 5 and 6 lower and raise the
      level.
    </p>
    <button
      type="button"
      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
      onClick={onOverlayClosed}
    >
      Close
    </button>
  </section>
)

export default DevelopmentPanel
