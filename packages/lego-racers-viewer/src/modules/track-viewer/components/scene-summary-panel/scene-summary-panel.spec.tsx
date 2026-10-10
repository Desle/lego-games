import { fireEvent, render } from '@testing-library/react'
import SceneSummaryPanel from './scene-summary-panel.tsx'

const SUMMARY = {
  worldPaths: ['GAMEDATA\\COMMON\\GLOBAL.WDB', 'GAMEDATA\\RACEC0R0\\RRTRK.WDB'],
  animatedInstanceCount: 0,
  instanceCount: 12,
  meshCount: 5,
  triangleCount: 5020,
  materialCount: 122,
  textureCount: 48,
  missingTextures: [],
  cameraNames: ['camDUM', ''],
  lightCount: 0,
}

describe('SceneSummaryPanel', () => {
  it('renders default snapshot', () => {
    // Arrange
    const summary = SUMMARY

    // Act
    const { container } = render(
      <SceneSummaryPanel summary={summary} selectedCameraIndex={0} onCameraSelected={vi.fn()} />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the overview and the missing textures', () => {
    // Arrange
    const summary = {
      ...SUMMARY,
      missingTextures: ['GAMEDATA\\COMMON\\FONT_HLP.BMP (file_not_found)'],
    }

    // Act
    const { container } = render(
      <SceneSummaryPanel summary={summary} selectedCameraIndex={null} onCameraSelected={vi.fn()} />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('reports the chosen camera, or null for the overview', () => {
    // Arrange
    const onCameraSelected = vi.fn()
    const { getByRole } = render(
      <SceneSummaryPanel
        summary={SUMMARY}
        selectedCameraIndex={0}
        onCameraSelected={onCameraSelected}
      />
    )

    // Act
    fireEvent.change(getByRole('combobox'), { target: { value: '1' } })
    fireEvent.change(getByRole('combobox'), { target: { value: 'overview' } })

    // Assert
    expect(onCameraSelected.mock.calls).toEqual([[1], [null]])
  })
})
