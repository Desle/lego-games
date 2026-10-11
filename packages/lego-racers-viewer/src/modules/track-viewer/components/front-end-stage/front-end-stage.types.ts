import type { RefObject } from 'react'

export type FrontEndStageProps = {
  readonly canvasReference: RefObject<HTMLCanvasElement | null>
  readonly errorMessage: string | null
  // The size the 640 × 480 menus are shown at.
  readonly width: number
  readonly height: number
}
