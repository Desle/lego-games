import type { ChangeEvent } from 'react'
import type { SceneSummaryPanelProps } from './scene-summary-panel.types.ts'

const OVERVIEW = 'overview'

// What the loaded scene holds, the camera choice and the textures that could not be shown.
const SceneSummaryPanel = ({
  summary,
  selectedCameraIndex,
  onCameraSelected,
}: SceneSummaryPanelProps) => {
  const onCameraChange = (event: ChangeEvent<HTMLSelectElement>) =>
    onCameraSelected(event.target.value === OVERVIEW ? null : Number(event.target.value))
  return (
    <section className="flex flex-col gap-2 text-xs">
      <ul className="font-mono text-slate-400">
        {summary.worldPaths.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
      <p>
        {summary.instanceCount} instances · {summary.meshCount} models · {summary.triangleCount}{' '}
        triangles · {summary.materialCount} materials · {summary.textureCount} textures ·{' '}
        {summary.lightCount} lights
      </p>
      <label className="flex items-center gap-2">
        Camera
        <select
          className="rounded bg-slate-800 px-1"
          value={selectedCameraIndex === null ? OVERVIEW : String(selectedCameraIndex)}
          onChange={onCameraChange}
        >
          <option value={OVERVIEW}>Overview</option>
          {summary.cameraNames.map((name, index) => (
            <option key={`${name}-${String(index)}`} value={String(index)}>
              {name === '' ? `Camera ${String(index + 1)}` : name}
            </option>
          ))}
        </select>
      </label>
      {summary.missingTextures.length > 0 && (
        <details>
          <summary>{summary.missingTextures.length} textures without an image</summary>
          <ul className="font-mono text-slate-400">
            {summary.missingTextures.map((texture) => (
              <li key={texture}>{texture}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

export default SceneSummaryPanel
