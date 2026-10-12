import { useEffect, useRef, useState } from 'react'
import type { LetterboxScale, StageSize } from './letterbox-scale.types.ts'

// The scale that fits a fixed-size stage into its frame, keeping the stage's aspect ratio (the rest is black bars).
export const useLetterboxScale = (stageSize: StageSize): LetterboxScale => {
  const frameReference = useRef<HTMLElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const frame = frameReference.current
    if (frame === null) return undefined
    const observer = new ResizeObserver(() =>
      setScale(
        Math.min(frame.clientWidth / stageSize.width, frame.clientHeight / stageSize.height) || 1
      )
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [stageSize.width, stageSize.height])
  return { frameReference, scale }
}
