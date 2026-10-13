import type { BuilderGroundAxes, BuilderView } from './builder-camera.types.ts'
import type { Vector } from './ldraw-builder.types.ts'

const ORBIT_RADIANS_PER_PIXEL = 0.006
const ZOOM_PER_PIXEL = 0.01
const ELEVATION_LIMIT = Math.PI / 2 - 0.01
const MINIMUM_DISTANCE = 0.5
const MAXIMUM_DISTANCE = 500

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

// A view looking at the target from a direction (target to camera) and a distance.
export const createBuilderView = (
  target: Vector,
  direction: Vector,
  distance: number
): BuilderView => {
  const length = Math.hypot(...direction) || 1
  return Object.freeze({
    target,
    azimuth: Math.atan2(direction[1], direction[0]),
    elevation: clamp(Math.asin(direction[2] / length), -ELEVATION_LIMIT, ELEVATION_LIMIT),
    distance: clamp(distance, MINIMUM_DISTANCE, MAXIMUM_DISTANCE),
  })
}

export const getBuilderViewPosition = (view: BuilderView): Vector => {
  const across = Math.cos(view.elevation) * view.distance
  return [
    view.target[0] + Math.cos(view.azimuth) * across,
    view.target[1] + Math.sin(view.azimuth) * across,
    view.target[2] + Math.sin(view.elevation) * view.distance,
  ]
}

// A two-finger scroll or an Option drag: across turns about the vertical, up and down tilts; the model follows the fingers.
export const orbitBuilderView = (view: BuilderView, deltaX: number, deltaY: number): BuilderView =>
  Object.freeze({
    ...view,
    azimuth: view.azimuth - deltaX * ORBIT_RADIANS_PER_PIXEL,
    elevation: clamp(
      view.elevation + deltaY * ORBIT_RADIANS_PER_PIXEL,
      -ELEVATION_LIMIT,
      ELEVATION_LIMIT
    ),
  })

// Moves the target in the screen's plane so the model follows the fingers; unitsPerPixel is the world size of a pixel at the target.
export const panBuilderView = (
  view: BuilderView,
  deltaX: number,
  deltaY: number,
  unitsPerPixel: number
): BuilderView => {
  const right: Vector = [-Math.sin(view.azimuth), Math.cos(view.azimuth), 0]
  const up: Vector = [
    -Math.sin(view.elevation) * Math.cos(view.azimuth),
    -Math.sin(view.elevation) * Math.sin(view.azimuth),
    Math.cos(view.elevation),
  ]
  const across = -deltaX * unitsPerPixel
  const along = deltaY * unitsPerPixel
  return Object.freeze({
    ...view,
    target: [
      view.target[0] + right[0] * across + up[0] * along,
      view.target[1] + right[1] * across + up[1] * along,
      view.target[2] + right[2] * across + up[2] * along,
    ] as const,
  })
}

export const scaleBuilderView = (view: BuilderView, factor: number): BuilderView =>
  Object.freeze({
    ...view,
    distance: clamp(view.distance * factor, MINIMUM_DISTANCE, MAXIMUM_DISTANCE),
  })

// A pinch (a wheel event with ctrlKey): spreading the fingers (a negative delta) comes closer.
export const zoomBuilderView = (view: BuilderView, deltaY: number): BuilderView =>
  scaleBuilderView(view, Math.exp(deltaY * ZOOM_PER_PIXEL))

export const getBuilderGroundAxes = (view: BuilderView): BuilderGroundAxes => ({
  right: [-Math.sin(view.azimuth), Math.cos(view.azimuth), 0],
  forward: [-Math.cos(view.azimuth), -Math.sin(view.azimuth), 0],
})
