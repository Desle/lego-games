import type { Box3, DataTexture, Group, MaterialParameters } from 'three'

export type SceneObject = {
  readonly group: Group
  // The instances' world-space bounds, for framing the camera.
  readonly bounds: Box3
  readonly dispose: () => void
}

export type TextureCache = Map<string, DataTexture>

// three.js's own parameter names, so the boolean keeps its library name.
export type BlendingParameters = Pick<
  MaterialParameters,
  'blending' | 'blendSrc' | 'blendDst' | 'transparent'
>
