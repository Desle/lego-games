import {
  DepthTexture,
  DoubleSide,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  RedFormat,
  Vector2,
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
import { setIsShadowRenderActive } from '../ldraw-car/detail-switch.ts'
import { bakeSceneryShadow } from './baked-scenery-shadow.ts'
import type { BakedSceneryShadow } from './baked-scenery-shadow.types.ts'
import { createLightFrame } from './light-frame.ts'
import { hideBlobShadows, hideNonCasters, showAgain } from './shadow-casters.ts'
import { makeTrackReceivers } from './shadow-receiver.ts'
import type { ShadowUniforms } from './shadow-receiver.types.ts'
import { ShadowMode } from './shadow-mode.types.ts'

const NEAR_PLANE = 0.1

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
  const { camera: lightCamera, axes } = createLightFrame(worldSun, NEAR_PLANE, depthDistance * 2)
  lightCamera.left = -SHADOW_RADIUS
  lightCamera.right = SHADOW_RADIUS
  lightCamera.top = SHADOW_RADIUS
  lightCamera.bottom = -SHADOW_RADIUS
  lightCamera.updateProjectionMatrix()
  const { right, up, back } = axes
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
    isBakedShadowEnabled: { value: 0 },
    bakedShadowMatrix: { value: new Matrix4() },
    bakedShadowMap: { value: depthTexture },
    bakedShadowTexel: { value: 1 },
    bakedShadowMapTexel: { value: new Vector2(1, 1) },
    bakedShadowDepthBias: { value: 0 },
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

  let baked: BakedSceneryShadow | null = null
  const bakeOnce = () => {
    baked = bakeSceneryShadow(renderer, trackScene, trackGroup, worldSun)
    uniforms.isBakedShadowEnabled.value = 1
    uniforms.bakedShadowMatrix.value.copy(baked.matrix)
    uniforms.bakedShadowMap.value = baked.depthTexture
    uniforms.bakedShadowTexel.value = baked.texel
    uniforms.bakedShadowMapTexel.value.set(1 / baked.width, 1 / baked.height)
    uniforms.bakedShadowDepthBias.value =
      (baked.texel * SHADOW_DEPTH_BIAS_TEXELS) / baked.depthRange
    console.info(
      `scenery shadow baked: ${String(baked.width)} x ${String(baked.height)} texels of ${baked.texel.toFixed(2)} units in ${baked.bakeMilliseconds.toFixed(0)} ms`
    )
  }

  return {
    beforeRender: () => {
      if (mode === ShadowMode.SCENERY && baked === null) bakeOnce()
      hideBlobShadows(trackScene)
      placeLightCamera()
      const hidden = hideNonCasters(trackScene, trackGroup)
      const previousTarget = renderer.getRenderTarget()
      const previousOverride = trackScene.overrideMaterial
      trackScene.overrideMaterial = depthMaterial
      renderer.setRenderTarget(target)
      renderer.clear(false, true, false)
      setIsShadowRenderActive(true)
      renderer.render(trackScene, lightCamera)
      setIsShadowRenderActive(false)
      renderer.setRenderTarget(previousTarget)
      trackScene.overrideMaterial = previousOverride
      showAgain(hidden)
    },
    dispose: () => {
      target.dispose()
      depthTexture.dispose()
      depthMaterial.dispose()
      baked?.dispose()
    },
  }
}
