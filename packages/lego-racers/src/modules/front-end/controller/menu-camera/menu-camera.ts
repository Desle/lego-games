import type { MenuCamera } from '../../types/menu-world/menu-world.types.ts'

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
  }
  return Object.freeze(camera)
}
