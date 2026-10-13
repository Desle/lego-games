import { Matrix4, Vector2, Vector3 } from 'three'
import type { ShadowUniforms } from './shadow-receiver.types.ts'

// One set for the page: the LDraw plastic is compiled with these before any race exists, and each race's shadow pass fills them
// in. Strength 0 and no baked map until then, so the plastic is lit as without shadows.
export const SHARED_SHADOW_UNIFORMS: ShadowUniforms = Object.freeze({
  shadowMatrix: { value: new Matrix4() },
  shadowMap: { value: null },
  sunDirection: { value: new Vector3(0, 0, 1) },
  ambientShare: { value: 1 },
  shadowTexel: { value: 1 },
  shadowMapTexel: { value: 1 },
  shadowDepthBias: { value: 0 },
  shadowStrength: { value: 0 },
  isBakedShadowEnabled: { value: 0 },
  bakedShadowMatrix: { value: new Matrix4() },
  bakedShadowMap: { value: null },
  bakedShadowTexel: { value: 1 },
  bakedShadowMapTexel: { value: new Vector2(1, 1) },
  bakedShadowDepthBias: { value: 0 },
})
