export type TraceLine = {
  readonly frame?: number
  readonly dt?: number
  readonly fields?: Record<string, number[]>
  readonly isDone?: boolean
  readonly controlWord?: number
  readonly introductionCameraLimit?: number
  readonly introductionCameraRate?: number
}
