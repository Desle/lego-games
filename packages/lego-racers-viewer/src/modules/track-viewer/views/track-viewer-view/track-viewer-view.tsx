import JamFilePicker from '../../components/jam-file-picker/jam-file-picker.tsx'
import SceneSummaryPanel from '../../components/scene-summary-panel/scene-summary-panel.tsx'
import SceneViewport from '../../components/scene-viewport/scene-viewport.tsx'
import StatusMessage from '../../components/status-message/status-message.tsx'
import WorldList from '../../components/world-list/world-list.tsx'
import { useTrackViewer } from '../../providers/track-viewer-provider/track-viewer-provider.tsx'
import { ViewerStatus } from '../../types/viewer-status/viewer-status.ts'

const TrackViewerView = () => {
  const viewer = useTrackViewer()
  const isBusy =
    viewer.status === ViewerStatus.READING_ARCHIVE || viewer.status === ViewerStatus.LOADING_SCENE
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
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
        </header>
        <div className="min-h-0 flex-1">
          <SceneViewport scene={viewer.scene} selectedCameraIndex={viewer.selectedCameraIndex} />
        </div>
      </main>
    </div>
  )
}

export default TrackViewerView
