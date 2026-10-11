import { getBoundingSphere } from '../../../racer-collision/index.ts'
import type { BoundingSphere } from '../../../racer-collision/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Vector3 } from '../../../simulation-math/index.ts'
import { getFigureBounds } from '../figure/figure.ts'
import type { Figure, Racer } from '../racer.types.ts'
import type { RacerVolumeParts } from './racer-volume.types.ts'

// 0x004113c0 -> 0x0040e0b0: a figure's sphere carried by its frame; a figure without a model part has radius 0
// around the origin.
export const getFigureSphere = (
  arithmetic: FloatArithmetic,
  figure: Figure,
  frame: Frame
): BoundingSphere => {
  const bounds = getFigureBounds(arithmetic, figure)
  if (bounds === null) return { centre: ZERO_VECTOR3, radius: 0 }
  return getBoundingSphere(arithmetic, frame, bounds.centre, bounds.radius)
}

// The spheres of the volume's children: the car body model (vehicle +0x3c), the second chassis figure (+0x40), the
// display figure (+0x44) and the driver (+0x48). The body and the driver share the leaned rotation; the body sits at
// the display frame's position and the driver at the seat.
export const getFreshRacerVolumeParts = (
  arithmetic: FloatArithmetic,
  racer: Racer
): RacerVolumeParts => {
  const { vehicle } = racer
  const { displayFrame } = racer.carBody.rigidBody
  const bodyFrame: Frame = { rotation: vehicle.bodyRotation, position: displayFrame.position }
  const driverFrame: Frame = { rotation: vehicle.bodyRotation, position: vehicle.driverPosition }
  return Object.freeze({
    body:
      vehicle.bodyBounds === null
        ? null
        : getBoundingSphere(
            arithmetic,
            bodyFrame,
            vehicle.bodyBounds.centre,
            vehicle.bodyBounds.radius,
            vehicle.bodyScale
          ),
    second:
      vehicle.secondFigure === null
        ? null
        : getFigureSphere(arithmetic, vehicle.secondFigure, displayFrame),
    wheels: getFigureSphere(arithmetic, racer.figure, displayFrame),
    driver: getFigureSphere(arithmetic, vehicle.driverFigure, driverFrame),
  })
}

// The caches as they stand (the trace reads them raw): a part the vehicle holds a cache for shows it, the others are
// fresh.
export const getRacerVolumeParts = (
  arithmetic: FloatArithmetic,
  racer: Racer
): RacerVolumeParts => {
  const fresh = getFreshRacerVolumeParts(arithmetic, racer)
  const caches = racer.vehicle.boundsCaches
  if (caches === null) return fresh
  return Object.freeze({
    body: caches.body ?? fresh.body,
    second: caches.second ?? fresh.second,
    wheels: caches.wheels ?? fresh.wheels,
    driver: caches.driver ?? fresh.driver,
  })
}

// What a getter (0x00411c60, 0x00411ca0) hands out: a cache with a negative radius is refreshed first, so it reads as
// the fresh sphere; a valid cache is read as it stands.
export const getRacerReadVolumeParts = (
  arithmetic: FloatArithmetic,
  racer: Racer
): RacerVolumeParts => {
  const fresh = getFreshRacerVolumeParts(arithmetic, racer)
  const caches = racer.vehicle.boundsCaches
  if (caches === null) return fresh
  const read = <Current extends BoundingSphere | null>(
    cache: BoundingSphere | null,
    current: Current
  ): Current | BoundingSphere => (cache !== null && cache.radius >= 0 ? cache : current)
  return Object.freeze({
    body: read(caches.body, fresh.body),
    second: read(caches.second, fresh.second),
    wheels: read(caches.wheels, fresh.wheels),
    driver: read(caches.driver, fresh.driver),
  })
}

const getChildSpheres = (arithmetic: FloatArithmetic, racer: Racer): readonly BoundingSphere[] => {
  const { body, second, wheels, driver } = getFreshRacerVolumeParts(arithmetic, racer)
  return [body, second, wheels, driver].filter((sphere) => sphere !== null)
}

// 0x00411ef0 (the composite sphere's recompute, racer +0x1c): the first child's centre is the origin; the mean offset
// of the children from it (the offsets summed, then scaled by 1 / count, each stored) moves the centre, and the radius
// is the largest of `child radius + distance from the mean` (the distance is (z² + y²) + x² rooted, the sum unrounded).
export const getRacerVolume = (arithmetic: FloatArithmetic, racer: Racer): BoundingSphere => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat, getIsBelowOrEqual } =
    arithmetic
  const children = getChildSpheres(arithmetic, racer)
  const origin = children[0]?.centre ?? ZERO_VECTOR3
  const getOffset = (centre: Vector3): Vector3 =>
    Object.freeze({
      x: storeFloat(subtract(centre.x, origin.x)),
      y: storeFloat(subtract(centre.y, origin.y)),
      z: storeFloat(subtract(centre.z, origin.z)),
    })
  const weight = storeFloat(divide(1, children.length))
  const sum = children.reduce<Vector3>(
    (total, child) => {
      const offset = getOffset(child.centre)
      return Object.freeze({
        x: storeFloat(add(offset.x, total.x)),
        y: storeFloat(add(offset.y, total.y)),
        z: storeFloat(add(offset.z, total.z)),
      })
    },
    { x: 0, y: 0, z: 0 }
  )
  const mean = Object.freeze({
    x: storeFloat(multiply(weight, sum.x)),
    y: storeFloat(multiply(weight, sum.y)),
    z: storeFloat(multiply(weight, sum.z)),
  })
  const radius = children.reduce((largest, child) => {
    const offset = getOffset(child.centre)
    const x = storeFloat(subtract(offset.x, mean.x))
    const y = storeFloat(subtract(offset.y, mean.y))
    const z = storeFloat(subtract(offset.z, mean.z))
    const distance = getSquareRoot(add(add(multiply(z, z), multiply(y, y)), multiply(x, x)))
    const candidate = add(child.radius, distance)
    return getIsBelowOrEqual(candidate, largest) ? largest : storeFloat(candidate)
  }, 0)
  return Object.freeze({
    centre: Object.freeze({
      x: storeFloat(add(origin.x, mean.x)),
      y: storeFloat(add(origin.y, mean.y)),
      z: storeFloat(add(origin.z, mean.z)),
    }),
    radius,
  })
}
