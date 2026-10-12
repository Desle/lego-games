import { OrthographicCamera, Vector3 } from 'three'
import type { LightFrameAxes } from './baked-scenery-shadow.types.ts'

const VERTICAL_SUN = 0.99

// An orthographic camera at the origin looking down the sun's rays, and the axes it looks along.
export const createLightFrame = (worldSun: Vector3, near: number, far: number) => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, near, far)
  const isSunVertical = Math.abs(worldSun.z) > VERTICAL_SUN
  camera.up.set(isSunVertical ? 1 : 0, 0, isSunVertical ? 0 : 1)
  camera.lookAt(worldSun.clone().negate())
  camera.updateMatrixWorld(true)
  const axes: LightFrameAxes = {
    right: new Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
    up: new Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
    back: new Vector3().setFromMatrixColumn(camera.matrixWorld, 2),
  }
  return { camera, axes }
}
