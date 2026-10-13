import type { DepthTexture, Matrix4, Vector2, Vector3 } from 'three'

type Uniform<Value> = { value: Value }

// The values every receiving material reads; one object shared by all of them, updated once per frame.
export type ShadowUniforms = {
  readonly shadowMatrix: Uniform<Matrix4>
  readonly shadowMap: Uniform<DepthTexture | null>
  readonly sunDirection: Uniform<Vector3>
  readonly ambientShare: Uniform<number>
  readonly shadowTexel: Uniform<number>
  readonly shadowMapTexel: Uniform<number>
  readonly shadowDepthBias: Uniform<number>
  readonly shadowStrength: Uniform<number>
  // The static scenery's shadow, baked once over the whole track (0 until it is drawn, and in modes without scenery).
  readonly isBakedShadowEnabled: Uniform<number>
  readonly bakedShadowMatrix: Uniform<Matrix4>
  readonly bakedShadowMap: Uniform<DepthTexture | null>
  readonly bakedShadowTexel: Uniform<number>
  readonly bakedShadowMapTexel: Uniform<Vector2>
  readonly bakedShadowDepthBias: Uniform<number>
}
