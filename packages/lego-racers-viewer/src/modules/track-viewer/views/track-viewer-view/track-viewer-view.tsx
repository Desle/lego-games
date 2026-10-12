import { useState } from 'react'
import AnimationControl from '../../components/animation-control/animation-control.tsx'
import JamFilePicker from '../../components/jam-file-picker/jam-file-picker.tsx'
import SceneSummaryPanel from '../../components/scene-summary-panel/scene-summary-panel.tsx'
import SceneViewport from '../../components/scene-viewport/scene-viewport.tsx'
import StatusMessage from '../../components/status-message/status-message.tsx'
import WorldList from '../../components/world-list/world-list.tsx'
import { useTrackViewer } from '../../providers/track-viewer-provider/track-viewer-provider.tsx'
import { ViewerStatus } from '../../types/viewer-status/viewer-status.ts'
import RaceView from '../race-view/race-view.tsx'

const TrackViewerView = () => {
  const viewer = useTrackViewer()
  const [isRaceMode, setIsRaceMode] = useState(true)
  const isBusy =
    viewer.status === ViewerStatus.READING_ARCHIVE || viewer.status === ViewerStatus.LOADING_SCENE
  return (
    <div className="relative flex h-dvh bg-slate-900 text-slate-100">
      {import.meta.env.DEV && (
        <button
          type="button"
          className="absolute top-2 right-2 z-10 rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          aria-pressed={isRaceMode}
          onClick={() => setIsRaceMode((isPreviousRaceMode) => !isPreviousRaceMode)}
        >
          {isRaceMode ? 'Track viewer' : 'Race'}
        </button>
      )}
      {isRaceMode ? (
        <RaceView />
      ) : (
        <>
          <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-700 p-4">
            <h1 className="text-lg font-bold">LEGO Racers track viewer</h1>
            <JamFilePicker
              isBusy={isBusy}
              isDevelopmentJamAvailable={viewer.isDevelopmentJamAvailable}
              onJamFileChosen={viewer.onJamFileChosen}
              onDevelopmentJamRequested={viewer.onDevelopmentJamRequested}
            />
            <WorldList
              worldGroups={viewer.worldGroups}
              selectedEntryId={viewer.selectedEntryId}
              isDisabled={isBusy}
              onWorldEntrySelected={viewer.onWorldEntrySelected}
            />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <header className="flex flex-col gap-2 border-b border-slate-700 p-3 text-sm">
              <StatusMessage status={viewer.status} errorMessage={viewer.errorMessage} />
              {viewer.sceneSummary !== null && (
                <SceneSummaryPanel
                  summary={viewer.sceneSummary}
                  selectedCameraIndex={viewer.selectedCameraIndex}
                  onCameraSelected={viewer.onCameraSelected}
                />
              )}
              {viewer.sceneSummary !== null && (
                <AnimationControl
                  isPlaying={viewer.isAnimationPlaying}
                  animatedInstanceCount={viewer.sceneSummary.animatedInstanceCount}
                  isSkyShown={viewer.background?.sky != null}
                  onPlayingToggled={viewer.onAnimationPlayingToggled}
                />
              )}
            </header>
            <div className="min-h-0 flex-1">
              <SceneViewport
                scene={viewer.scene}
                background={viewer.background}
                selectedCameraIndex={viewer.selectedCameraIndex}
                isAnimationPlaying={viewer.isAnimationPlaying}
              />
            </div>
          </main>
        </>
      )}
    </div>
  )
}

export default TrackViewerView
