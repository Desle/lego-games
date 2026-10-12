import type { RefObject } from 'react'

export type LetterboxScale = {
  readonly frameReference: RefObject<HTMLElement | null>
  readonly scale: number
}

export type StageSize = {
  readonly width: number
  readonly height: number
}
