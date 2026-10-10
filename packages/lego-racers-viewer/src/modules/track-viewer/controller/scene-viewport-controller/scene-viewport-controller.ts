import type { Scene } from '@lego-games/lego-racers/scene'
import { useEffect, useRef } from 'react'
import { createSceneViewport } from '../../services/scene-viewport/scene-viewport.ts'
import type { SceneViewport } from '../../services/scene-viewport/scene-viewport.types.ts'

// Owns the WebGL viewport inside the returned element: shows the scene and moves to the chosen camera.
export const useSceneViewportController = (scene: Scene | null, cameraIndex: number | null) => {
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

  useEffect(() => viewportReference.current?.showScene(scene), [scene])

  useEffect(() => viewportReference.current?.showCamera(cameraIndex), [scene, cameraIndex])

  return containerReference
}
