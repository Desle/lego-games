import { useSceneViewportController } from '../../controller/scene-viewport-controller/scene-viewport-controller.ts'
import type { SceneViewportProps } from './scene-viewport.types.ts'

// The WebGL canvas. Drag to orbit, scroll to zoom, WASD to fly, Q/E to sink and rise.
const SceneViewport = ({
  scene,
  background,
  selectedCameraIndex,
  isAnimationPlaying,
}: SceneViewportProps) => {
  const containerReference = useSceneViewportController(
    scene,
    background,
    selectedCameraIndex,
    isAnimationPlaying
  )
  return <div ref={containerReference} className="h-full w-full" data-testid="scene-viewport" />
}

export default SceneViewport
