import type { SunDirection } from './real-shadows.types.ts'

const DEGREES = Math.PI / 180

// The unit vector towards the sun: the azimuth runs from +x towards +y, the elevation up from the horizon (degrees).
export const getSunDirection = (azimuthDegrees: number, elevationDegrees: number): SunDirection => [
  Math.cos(elevationDegrees * DEGREES) * Math.cos(azimuthDegrees * DEGREES),
  Math.cos(elevationDegrees * DEGREES) * Math.sin(azimuthDegrees * DEGREES),
  Math.sin(elevationDegrees * DEGREES),
]
