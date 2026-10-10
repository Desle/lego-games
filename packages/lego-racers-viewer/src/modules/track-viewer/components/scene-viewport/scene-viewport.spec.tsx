import { render } from '@testing-library/react'
import { useSceneViewportController } from '../../controller/scene-viewport-controller/scene-viewport-controller.ts'
import SceneViewport from './scene-viewport.tsx'

// jsdom has no WebGL; the viewport's controller is replaced by a plain element reference.
vi.mock('../../controller/scene-viewport-controller/scene-viewport-controller.ts', () => ({
  useSceneViewportController: vi.fn(() => ({ current: null })),
}))

describe('SceneViewport', () => {
  it('renders default snapshot', () => {
    // Arrange
    const scene = null

    // Act
    const { container } = render(
      <SceneViewport
        scene={scene}
        background={null}
        selectedCameraIndex={null}
        isAnimationPlaying
      />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('hands the scene, background, camera and playback to its controller', () => {
    // Arrange
    const selectedCameraIndex = 2

    // Act
    render(
      <SceneViewport
        scene={null}
        background={null}
        selectedCameraIndex={selectedCameraIndex}
        isAnimationPlaying={false}
      />
    )

    // Assert
    expect(useSceneViewportController).toHaveBeenLastCalledWith(null, null, 2, false)
  })
})
