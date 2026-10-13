// What the last frame cost the GPU.
export type ModelViewerStats = {
  readonly drawCalls: number
  readonly triangles: number
}

// A new model is framed by the camera unless the caller keeps the view (the same model again, edited).
export type ShowModelOptions = {
  readonly isCameraKept: boolean
}
