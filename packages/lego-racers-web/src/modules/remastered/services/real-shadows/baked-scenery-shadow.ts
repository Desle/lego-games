import {
  Box3,
  DepthTexture,
  DoubleSide,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  RedFormat,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import type { Group, Scene, WebGLRenderer } from 'three'
import { getBakedShadowSize } from './baked-shadow-size.ts'
import type { BakedSceneryShadow, LightFrameAxes } from './baked-scenery-shadow.types.ts'
import { createLightFrame } from './light-frame.ts'
import { showStaticSceneryOnly } from './shadow-casters.ts'

const NEAR_PLANE = 0.1
const MARGIN = 1
const BOX_CORNERS = 8

// The bounds of the shown instances in the light's axes: x along right, y along up, z along back.
const getLightBounds = (shown: readonly Group[], axes: LightFrameAxes) => {
  const minimum = new Vector3(Infinity, Infinity, Infinity)
  const maximum = new Vector3(-Infinity, -Infinity, -Infinity)
  const corner = new Vector3()
  const inLight = new Vector3()
  const box = new Box3()
  for (const instance of shown) {
    box.setFromObject(instance)
    if (box.isEmpty()) continue
    for (let index = 0; index < BOX_CORNERS; index += 1) {
      corner.set(
        index & 1 ? box.max.x : box.min.x,
        index & 2 ? box.max.y : box.min.y,
        index & 4 ? box.max.z : box.min.z
      )
      inLight.set(corner.dot(axes.right), corner.dot(axes.up), corner.dot(axes.back))
      minimum.min(inLight)
      maximum.max(inLight)
    }
  }
  return { minimum: minimum.subScalar(MARGIN), maximum: maximum.addScalar(MARGIN) }
}

// Draws the static scenery once, from the sun, over the whole track's bounds into one map (its longer side `size` texels): the
// map holds every wall, post and rail of the track, so nothing pops in or out and nothing is redrawn per frame.
export const bakeSceneryShadow = (
  renderer: WebGLRenderer,
  trackScene: Scene,
  trackGroup: Group,
  worldSun: Vector3
): BakedSceneryShadow => {
  const startedAt = performance.now()
  const size = getBakedShadowSize(
    renderer.capabilities.maxTextureSize,
    Math.min(globalThis.screen.width, globalThis.screen.height)
  )
  trackScene.updateMatrixWorld(true)
  const view = showStaticSceneryOnly(trackScene, trackGroup)
  const { camera, axes } = createLightFrame(worldSun, NEAR_PLANE, 1)
  const { minimum, maximum } = getLightBounds(view.shown as readonly Group[], axes)
  const extent = new Vector3().subVectors(maximum, minimum)
  const texel = Math.max(extent.x, extent.y) / size
  const width = Math.max(1, Math.ceil(extent.x / texel))
  const height = Math.max(1, Math.ceil(extent.y / texel))
  camera.left = -extent.x / 2
  camera.right = extent.x / 2
  camera.top = extent.y / 2
  camera.bottom = -extent.y / 2
  camera.far = extent.z + NEAR_PLANE * 2
  camera.updateProjectionMatrix()
  camera.position
    .set(0, 0, 0)
    .addScaledVector(axes.right, (minimum.x + maximum.x) / 2)
    .addScaledVector(axes.up, (minimum.y + maximum.y) / 2)
    .addScaledVector(axes.back, maximum.z + NEAR_PLANE)
  camera.updateMatrixWorld(true)

  const depthTexture = new DepthTexture(width, height)
  depthTexture.compareFunction = LessEqualCompare
  depthTexture.minFilter = LinearFilter
  depthTexture.magFilter = LinearFilter
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: true,
    depthTexture,
    format: RedFormat,
    generateMipmaps: false,
  })
  const depthMaterial = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide })
  const previousTarget = renderer.getRenderTarget()
  const previousOverride = trackScene.overrideMaterial
  // eslint-disable-next-line no-param-reassign -- the scene draws the depth material for this one pass
  trackScene.overrideMaterial = depthMaterial
  renderer.setRenderTarget(target)
  renderer.clear(false, true, false)
  renderer.render(trackScene, camera)
  renderer.setRenderTarget(previousTarget)
  // eslint-disable-next-line no-param-reassign -- puts the scene's own materials back
  trackScene.overrideMaterial = previousOverride
  view.restore()
  depthMaterial.dispose()
  renderer.getContext().finish()

  return {
    depthTexture,
    matrix: new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    width,
    height,
    texel,
    depthRange: camera.far - camera.near,
    bakeMilliseconds: performance.now() - startedAt,
    dispose: () => {
      target.dispose()
      depthTexture.dispose()
    },
  }
}
