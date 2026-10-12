import DevelopmentPanel from '../../components/development-panel/development-panel.tsx'
import { useDevelopmentOverlayController } from '../../controller/development-overlay-controller/development-overlay-controller.ts'
import { TrackViewerProvider } from '../../providers/track-viewer-provider/track-viewer-provider.tsx'
import TrackViewerView from '../track-viewer-view/track-viewer-view.tsx'
import type { DevelopmentOverlayProps } from './development-overlay.types.ts'

// Development builds only: everything for the developer, behind the backquote key.
const DevelopmentOverlay = ({ isRaceRunning, onRaceStopped }: DevelopmentOverlayProps) => {
  const overlay = useDevelopmentOverlayController()
  return (
    <>
      {overlay.isOverlayOpen && (
        <DevelopmentPanel
          isRaceRunning={isRaceRunning}
          onTrackViewerOpened={overlay.onTrackViewerOpened}
          onRaceStopped={onRaceStopped}
          onRecordingDownloaded={overlay.onRecordingDownloaded}
          onEverythingUnlocked={overlay.onEverythingUnlocked}
          onOverlayClosed={overlay.onOverlayClosed}
        />
      )}
      {overlay.isTrackViewerOpen && (
        <div className="fixed inset-0 z-40">
          <TrackViewerProvider>
            <TrackViewerView />
          </TrackViewerProvider>
          <button
            type="button"
            className="absolute top-2 right-2 rounded bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
            onClick={overlay.onTrackViewerClosed}
          >
            Close the track viewer
          </button>
        </div>
      )}
    </>
  )
}

export default DevelopmentOverlay
