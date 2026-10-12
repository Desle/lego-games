import { getBillboardAxes, getSpriteQuad } from '../../../emitter/index.ts'
import type { BillboardAxes, EmitterQuad } from '../../../emitter/index.ts'
import type { SceneSprite } from '../../../scene/index.ts'
import { getNormalizedVector3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { WorldSpriteCamera } from '../../types/world-sprite.types.ts'

const getNegated = (vector: Vector3): Vector3 =>
  Object.freeze({ x: -vector.x, y: -vector.y, z: -vector.z })

const getMirrored = (vector: Vector3): Vector3 =>
  Object.freeze({ x: vector.x, y: -vector.y, z: vector.z })

// GolDP.dll 0x10014e50 with keyword 0x38: the sprite turns around its axis. The view direction loses its component
// along the axis and is normalized; the rows are that facing, axis x facing, and the axis itself.
const getAxisAxes = (
  arithmetic: FloatArithmetic,
  forward: Vector3,
  axis: Vector3
): BillboardAxes => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const toward = getNegated(forward)
  const along = add(
    add(multiply(toward.x, axis.x), multiply(toward.y, axis.y)),
    multiply(axis.z, toward.z)
  )
  const facing = getNormalizedVector3(
    arithmetic,
    Object.freeze({
      x: storeFloat(subtract(toward.x, multiply(along, axis.x))),
      y: storeFloat(subtract(toward.y, multiply(axis.y, along))),
      z: storeFloat(subtract(toward.z, multiply(axis.z, along))),
    })
  )
  return Object.freeze({
    right: Object.freeze({
      x: storeFloat(subtract(multiply(facing.z, axis.y), multiply(axis.z, facing.y))),
      y: storeFloat(subtract(multiply(axis.z, facing.x), multiply(facing.z, axis.x))),
      z: storeFloat(subtract(multiply(facing.y, axis.x), multiply(axis.y, facing.x))),
    }),
    down: getNegated(axis),
  })
}

// GolDP.dll 0x10029fa0: a sprite is drawn when its squared distance to the camera, neither zero nor above the sprite's
// limit, is reached.
const getIsWithinDistance = (
  arithmetic: FloatArithmetic,
  sprite: SceneSprite,
  position: Vector3,
  camera: Vector3
): boolean => {
  const { add, multiply, getIsEqual, getIsBelowOrEqual } = arithmetic
  const x = arithmetic.subtract(camera.x, position.x)
  const y = arithmetic.subtract(camera.y, position.y)
  const z = arithmetic.subtract(camera.z, position.z)
  const squaredDistance = add(add(multiply(z, z), multiply(y, y)), multiply(x, x))
  return (
    !getIsEqual(squaredDistance, 0) && getIsBelowOrEqual(squaredDistance, sprite.squaredDistance)
  )
}

// The quads of the world's sprites for one camera (GolDP.dll 0x10009a70, called per sprite by the world's draw
// 0x10018270 after its instances, in the world's order). Each is a rectangle `width` by `height` centred on the sprite
// (named by `materialNames`, the scene's materials in order) that faces the camera whole, or turns around its axis. `isMirrored` is the race flag that negates y in every loader.
export const getWorldSpriteQuads = (
  arithmetic: FloatArithmetic,
  sprites: readonly SceneSprite[],
  materialNames: readonly string[],
  camera: WorldSpriteCamera,
  isMirrored: boolean
): readonly EmitterQuad[] => {
  const cameraAxes = getBillboardAxes(arithmetic, camera.forward, camera.up)
  return Object.freeze(
    sprites.flatMap((sprite): readonly EmitterQuad[] => {
      const materialName =
        sprite.materialIndex === null ? undefined : materialNames[sprite.materialIndex]
      const position = isMirrored ? getMirrored(sprite.position) : sprite.position
      if (
        materialName === undefined ||
        !getIsWithinDistance(arithmetic, sprite, position, camera.position)
      ) {
        return []
      }
      const axis = sprite.axis !== null && isMirrored ? getMirrored(sprite.axis) : sprite.axis
      const axes = axis === null ? cameraAxes : getAxisAxes(arithmetic, camera.forward, axis)
      return [
        getSpriteQuad(arithmetic, axes, {
          materialName,
          position,
          width: sprite.width,
          height: sprite.height,
        }),
      ]
    })
  )
}
