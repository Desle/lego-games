import {
  DepthTexture,
  DoubleSide,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  RedFormat,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import type {
  RaceRenderPass,
  RaceRenderRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { SunLight } from './real-shadows.types.ts'
import {
  SHADOW_DEPTH_BIAS_TEXELS,
  SHADOW_FOCUS_AHEAD,
  SHADOW_MAP_SIZE,
  SHADOW_RADIUS,
  SHADOW_STRENGTH,
} from './shadow-pass.constants.ts'
import { hideBlobShadows, hideNonCasters, showAgain } from './shadow-casters.ts'
import { makeTrackReceivers } from './shadow-receiver.ts'
import type { ShadowUniforms } from './shadow-receiver.types.ts'
import type { ShadowMode } from './shadow-mode.types.ts'

const NEAR_PLANE = 0.1
const VERTICAL_SUN = 0.99

// Shadow maps for a race: the cars, wheels, drivers, power-up bricks, projectiles and hazards are drawn depth-only from the sun
// into a map that follows the camera in whole texels (so it does not shimmer); the track's own materials then darken their
// baked colour where the sun is blocked.
export const createShadowPass = (
  request: RaceRenderRequest,
  mode: ShadowMode,
  sun: SunLight
): RaceRenderPass => {
  const { renderer, camera, trackScene, trackGroup } = request
  trackGroup.updateMatrix()
  const worldSun = new Vector3(...sun.direction).transformDirection(trackGroup.matrix)
  const depthTexture = new DepthTexture(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
  depthTexture.compareFunction = LessEqualCompare
  depthTexture.minFilter = LinearFilter
  depthTexture.magFilter = LinearFilter
  const target = new WebGLRenderTarget(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, {
    depthBuffer: true,
    depthTexture,
    format: RedFormat,
    generateMipmaps: false,
  })
  const depthDistance = SHADOW_RADIUS * 3
  const lightCamera = new OrthographicCamera(
    -SHADOW_RADIUS,
    SHADOW_RADIUS,
    SHADOW_RADIUS,
    -SHADOW_RADIUS,
    NEAR_PLANE,
    depthDistance * 2
  )
  lightCamera.up.set(0, 0, Math.abs(worldSun.z) > VERTICAL_SUN ? 0 : 1)
  if (Math.abs(worldSun.z) > VERTICAL_SUN) lightCamera.up.set(1, 0, 0)
  lightCamera.position.set(0, 0, 0)
  lightCamera.lookAt(worldSun.clone().negate())
  lightCamera.updateMatrixWorld(true)
  const right = new Vector3().setFromMatrixColumn(lightCamera.matrixWorld, 0)
  const up = new Vector3().setFromMatrixColumn(lightCamera.matrixWorld, 1)
  const back = new Vector3().setFromMatrixColumn(lightCamera.matrixWorld, 2)
  const texel = (2 * SHADOW_RADIUS) / SHADOW_MAP_SIZE
  const uniforms: ShadowUniforms = {
    shadowMatrix: { value: new Matrix4() },
    shadowMap: { value: depthTexture },
    sunDirection: { value: worldSun },
    ambientShare: { value: sun.ambientShare },
    shadowTexel: { value: texel },
    shadowMapTexel: { value: 1 / SHADOW_MAP_SIZE },
    shadowDepthBias: { value: (texel * SHADOW_DEPTH_BIAS_TEXELS) / (depthDistance * 2) },
    shadowStrength: { value: SHADOW_STRENGTH },
  }
  makeTrackReceivers(trackGroup, uniforms)
  const depthMaterial = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide })
  const forward = new Vector3()
  const focus = new Vector3()

  const placeLightCamera = () => {
    camera.getWorldDirection(forward)
    focus.copy(camera.position).addScaledVector(forward, SHADOW_FOCUS_AHEAD)
    const snappedRight = Math.round(focus.dot(right) / texel) * texel
    const snappedUp = Math.round(focus.dot(up) / texel) * texel
    lightCamera.position
      .set(0, 0, 0)
      .addScaledVector(right, snappedRight)
      .addScaledVector(up, snappedUp)
      .addScaledVector(back, focus.dot(back) + depthDistance)
    lightCamera.updateMatrixWorld(true)
    uniforms.shadowMatrix.value.multiplyMatrices(
      lightCamera.projectionMatrix,
      lightCamera.matrixWorldInverse
    )
  }

  return {
    beforeRender: () => {
      hideBlobShadows(trackScene)
      placeLightCamera()
      const hidden = hideNonCasters(trackScene, trackGroup, mode)
      const previousTarget = renderer.getRenderTarget()
      const previousOverride = trackScene.overrideMaterial
      trackScene.overrideMaterial = depthMaterial
      renderer.setRenderTarget(target)
      renderer.clear(false, true, false)
      renderer.render(trackScene, lightCamera)
      renderer.setRenderTarget(previousTarget)
      trackScene.overrideMaterial = previousOverride
      showAgain(hidden)
    },
    dispose: () => {
      target.dispose()
      depthTexture.dispose()
      depthMaterial.dispose()
    },
  }
}
