import { DepthTexture, LessEqualCompare, Matrix4, Vector2, Vector3 } from 'three'
import type { ShadowUniforms } from './shadow-receiver.types.ts'

// A shadow sampler without a depth texture fails every draw that declares it (WebGL refuses a colour texture there): between races
// the maps point at this empty one.
const createPlaceholderMap = (): DepthTexture => {
  const texture = new DepthTexture(1, 1)
  texture.compareFunction = LessEqualCompare
  texture.needsUpdate = true
  return texture
}

export const PLACEHOLDER_SHADOW_MAP = createPlaceholderMap()

// One set for the page: the LDraw plastic is compiled with these before any race exists, and each race's shadow pass fills them
// in. Strength 0 and no baked map until then, so the plastic is lit as without shadows.
export const SHARED_SHADOW_UNIFORMS: ShadowUniforms = Object.freeze({
  shadowMatrix: { value: new Matrix4() },
  shadowMap: { value: PLACEHOLDER_SHADOW_MAP },
  sunDirection: { value: new Vector3(0, 0, 1) },
  ambientShare: { value: 1 },
  shadowTexel: { value: 1 },
  shadowMapTexel: { value: 1 },
  shadowDepthBias: { value: 0 },
  shadowStrength: { value: 0 },
  isBakedShadowEnabled: { value: 0 },
  bakedShadowMatrix: { value: new Matrix4() },
  bakedShadowMap: { value: PLACEHOLDER_SHADOW_MAP },
  bakedShadowTexel: { value: 1 },
  bakedShadowMapTexel: { value: new Vector2(1, 1) },
  bakedShadowDepthBias: { value: 0 },
})
