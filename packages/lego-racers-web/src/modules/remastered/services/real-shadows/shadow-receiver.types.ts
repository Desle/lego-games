import type { DepthTexture, Matrix4, Vector3 } from 'three'

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
}
