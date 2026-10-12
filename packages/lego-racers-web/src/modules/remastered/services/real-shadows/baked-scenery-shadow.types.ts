import type { DepthTexture, Matrix4, Object3D, Vector3 } from 'three'

export type VisibilityChange = {
  readonly object: Object3D
  readonly isVisibleBefore: boolean
}

export type StaticSceneryView = {
  readonly shown: readonly Object3D[]
  readonly restore: () => void
}

// The sun's orthographic view: the camera's axes in world space (`back` points towards the light).
export type LightFrameAxes = {
  readonly right: Vector3
  readonly up: Vector3
  readonly back: Vector3
}

export type BakedSceneryShadow = {
  readonly depthTexture: DepthTexture
  readonly matrix: Matrix4
  readonly width: number
  readonly height: number
  // World units one texel covers.
  readonly texel: number
  // World units from the near to the far plane (a depth difference of 1 in the map).
  readonly depthRange: number
  readonly bakeMilliseconds: number
  readonly dispose: () => void
}
