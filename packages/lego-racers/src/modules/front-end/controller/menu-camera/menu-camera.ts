import type { MenuCamera, WorldCamera } from '../../types/menu-world/menu-world.types.ts'

const WORLD_UP: readonly [number, number, number] = Object.freeze([0, 0, 1])

export const getMenuCamera = (values: readonly number[]): MenuCamera => {
  const [
    positionX,
    positionY,
    positionZ,
    targetX,
    targetY,
    targetZ,
    fieldOfView,
    near,
    far,
    aspect,
  ] = values
  const camera: MenuCamera = {
    position: [positionX ?? 0, positionY ?? 0, positionZ ?? 0],
    target: [targetX ?? 0, targetY ?? 0, targetZ ?? 0],
    fieldOfViewDegrees: fieldOfView ?? 45,
    nearPlane: near ?? 1,
    farPlane: far ?? 1000,
    aspectRatio: aspect ?? null,
    up: WORLD_UP,
  }
  return Object.freeze(camera)
}

// The camera the original draws a menu world with: the world's own, looking along its forward vector.
export const getWorldMenuCamera = (camera: WorldCamera): MenuCamera => {
  const menuCamera: MenuCamera = {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [
      camera.position.x + camera.forward.x,
      camera.position.y + camera.forward.y,
      camera.position.z + camera.forward.z,
    ],
    fieldOfViewDegrees: camera.fieldOfViewDegrees,
    nearPlane: camera.nearPlane,
    farPlane: camera.farPlane,
    aspectRatio: null,
    up: [camera.up.x, camera.up.y, camera.up.z],
  }
  return Object.freeze(menuCamera)
}
