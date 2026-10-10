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
    const { container } = render(<SceneViewport scene={scene} selectedCameraIndex={null} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('hands the scene and camera to its controller', () => {
    // Arrange
    const selectedCameraIndex = 2

    // Act
    render(<SceneViewport scene={null} selectedCameraIndex={selectedCameraIndex} />)

    // Assert
    expect(useSceneViewportController).toHaveBeenLastCalledWith(null, 2)
  })
})
