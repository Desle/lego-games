import { getBoundingSphere } from '../../../racer-collision/index.ts'
import type { BoundingSphere } from '../../../racer-collision/index.ts'
import {
  getFloatFromBits,
  getFrameTransformedPoint,
  getRotationFromFrameAxes,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Vector3 } from '../../../simulation-math/index.ts'
import { getTableCosine } from '../cosine-table/cosine-table.ts'
import { getFigureBounds } from '../figure/figure.ts'
import { getFigureSphere, getRacerVolumeParts } from '../racer-volume/racer-volume.ts'
import type { Figure, Racer, RacerTables } from '../racer.types.ts'

// 0x0045d940: the warp draws the car with the display figure at the origin, facing -y with z up.
const WARP_DRAW_FIRST_AXIS: Vector3 = Object.freeze({ x: 0, y: -1, z: 0 })
const WARP_DRAW_THIRD_AXIS: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })

// The fade of the warp's first half (0x0045dbe0): the effect's time in milliseconds turned into a table index,
// `(-ftol(time * 0.002 * pi * -162.97466) - 0x100) & 0x3ff` (a sine over one turn per second), read from the table
// at 0x004bf7ec.
const FADE_RATE = getFloatFromBits(0x3b03126f) // 0x004b02fc
const PI = getFloatFromBits(0x40490fdb) // 0x004b03f0
const TABLE_INDEX_SCALE = getFloatFromBits(0xc322f983) // 0x004b02f4, -1024 / 2pi
const TABLE_SIZE_MASK = 0x3ff
const TABLE_QUARTER_TURN = 0x100

const getWarpTableValue = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  radians: number
): number => {
  const index = Math.trunc(arithmetic.multiply(radians, TABLE_INDEX_SCALE))
  return getTableCosine(tables, (-index - TABLE_QUARTER_TURN) & TABLE_SIZE_MASK)
}

export const getWarpFadeScale = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  timeMilliseconds: number
): number =>
  getWarpTableValue(
    arithmetic,
    tables,
    arithmetic.multiply(arithmetic.multiply(timeMilliseconds, FADE_RATE), PI)
  )

// The warp draw's view swing (0x0045d940): the same table, read for the effect's timer (counting the 1,500 ms of the
// carry down) at `timer * pi * (1 / 1500)`.
const TUNNEL_RATE = getFloatFromBits(0x3a2ec33e) // 0x004b1aa8

export const getWarpTunnelSwing = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  timerMilliseconds: number
): number =>
  getWarpTableValue(
    arithmetic,
    tables,
    arithmetic.multiply(arithmetic.multiply(timerMilliseconds, PI), TUNNEL_RATE)
  )

const getFigureWithScale = (figure: Figure, scale: number): Figure =>
  Object.freeze({ ...figure, scale })

// 0x00440160 (thiscall on the vehicle: scale): the four parts take the scale (+0x58) and a negative radius, which
// the getters refresh at the next read. The raw centres stay as they were. The display figure's radius, which the
// ground probe reads through its getter (0x00411ca0), follows the new scale.
export const getRacerWithPartsMarked = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  scale: number
): Racer => {
  const raw = getRacerVolumeParts(arithmetic, racer)
  const marked = (sphere: BoundingSphere): BoundingSphere =>
    Object.freeze({ centre: sphere.centre, radius: -1 })
  const figure = getFigureWithScale(racer.figure, scale)
  const { vehicle } = racer
  const wheelsBounds = getFigureBounds(arithmetic, figure)
  return Object.freeze({
    ...racer,
    figure,
    carBody: Object.freeze({
      ...racer.carBody,
      rigidBody: Object.freeze({
        ...racer.carBody.rigidBody,
        displayBoundingRadius: wheelsBounds?.radius ?? 0,
      }),
    }),
    vehicle: Object.freeze({
      ...vehicle,
      bodyScale: scale,
      driverFigure: getFigureWithScale(vehicle.driverFigure, scale),
      secondFigure:
        vehicle.secondFigure === null ? null : getFigureWithScale(vehicle.secondFigure, scale),
      boundsCaches: Object.freeze({
        body: raw.body === null ? null : marked(raw.body),
        second: raw.second === null ? null : marked(raw.second),
        wheels: marked(raw.wheels),
        driver: marked(raw.driver),
      }),
    }),
  })
}

// 0x0045d940 while the player is carried (state 3), after the frame's update: the display figure moves to the origin
// facing -y (its radius goes negative), 0x0043e620 sets the car model, the second figure and the driver on that
// frame (the driver at the seat), the parts draw, which refreshes them, and the display figure goes back (its radius
// goes negative again, its centre stays at the origin). The car model's frame and the driver stay where the draw
// left them until the next update.
export const getRacerAfterWarpDraw = (arithmetic: FloatArithmetic, racer: Racer): Racer => {
  const rotation = getRotationFromFrameAxes(arithmetic, {
    first: WARP_DRAW_FIRST_AXIS,
    third: WARP_DRAW_THIRD_AXIS,
  })
  const frame: Frame = { rotation, position: ZERO_VECTOR3 }
  const { vehicle } = racer
  const driverPosition = getFrameTransformedPoint(arithmetic, frame, vehicle.seatPoint)
  const wheels = getFigureSphere(arithmetic, racer.figure, frame)
  return Object.freeze({
    ...racer,
    vehicle: Object.freeze({
      ...vehicle,
      bodyRotation: rotation,
      driverPosition,
      boundsCaches: Object.freeze({
        body:
          vehicle.bodyBounds === null
            ? null
            : getBoundingSphere(
                arithmetic,
                frame,
                vehicle.bodyBounds.centre,
                vehicle.bodyBounds.radius,
                vehicle.bodyScale
              ),
        second:
          vehicle.secondFigure === null
            ? null
            : getFigureSphere(arithmetic, vehicle.secondFigure, frame),
        wheels: Object.freeze({ centre: wheels.centre, radius: -1 }),
        driver: getFigureSphere(arithmetic, vehicle.driverFigure, {
          rotation,
          position: driverPosition,
        }),
      }),
    }),
  })
}
