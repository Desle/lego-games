import type { Scene } from '@lego-games/lego-racers/scene'
import { useEffect, useRef } from 'react'
import { createSceneViewport } from '../../services/scene-viewport/scene-viewport.ts'
import type { SceneViewport } from '../../services/scene-viewport/scene-viewport.types.ts'
import type { SceneBackground } from '../../types/track-viewer.types.ts'

// Owns the WebGL viewport inside the returned element: shows the scene with its background, moves to the
// chosen camera and plays or pauses the animation.
export const useSceneViewportController = (
  scene: Scene | null,
  background: SceneBackground | null,
  cameraIndex: number | null,
  isAnimationPlaying: boolean
) => {
  const containerReference = useRef<HTMLDivElement>(null)
  const viewportReference = useRef<SceneViewport | null>(null)

  useEffect(() => {
    const container = containerReference.current
    if (container === null) return undefined
    const viewport = createSceneViewport(container)
    viewportReference.current = viewport
    return () => {
      viewport.dispose()
      viewportReference.current = null
    }
  }, [])

  useEffect(() => viewportReference.current?.showScene(scene, background), [scene, background])

  useEffect(() => viewportReference.current?.showCamera(cameraIndex), [scene, cameraIndex])

  useEffect(
    () => viewportReference.current?.setIsAnimationPlaying(isAnimationPlaying),
    [scene, isAnimationPlaying]
  )

  return containerReference
}
