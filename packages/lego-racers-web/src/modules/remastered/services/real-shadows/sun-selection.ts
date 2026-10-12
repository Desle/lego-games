import type { Group } from 'three'
import { getSunDirection } from './sun-direction.ts'
import { estimateSun } from './sun-estimation.ts'
import type { SunLight } from './real-shadows.types.ts'
import { getTrackTriangles } from './track-triangles.ts'
import { TRACK_SUN_ESTIMATES, TRACK_SUNS } from './track-suns.ts'

export const SUN_PARAMETER = 'sun'
const DEFAULT_AMBIENT_SHARE = 0.45
const SUN_PARAMETER_PARTS = 2
const estimatedSuns = new Map<string, SunLight | null>()

// The track's world is named like `GAMEDATA\RACEC0R0\RACEC0R0.GDB`; the folder tells the tracks apart.
export const getTrackSunKey = (trackKey: string): string => {
  const parts = trackKey.toLowerCase().split(/[\\/]/)
  return parts.length >= SUN_PARAMETER_PARTS
    ? (parts[parts.length - SUN_PARAMETER_PARTS] ?? trackKey)
    : trackKey
}

// `sun=<azimuth>,<elevation>` (degrees, in the track's frame: azimuth from +x towards +y, elevation above the horizon) sets
// the sun by hand; `sun=<azimuth>,<elevation>,<ambient share>` also sets how bright the shade is.
export const getManualSun = (search: string): SunLight | null => {
  const requested = new URLSearchParams(search).get(SUN_PARAMETER)
  if (requested === null) return null
  const [azimuth, elevation, ambientShare] = requested.split(',').map(Number)
  if (azimuth === undefined || elevation === undefined) return null
  if (!Number.isFinite(azimuth) || !Number.isFinite(elevation)) return null
  return {
    direction: getSunDirection(azimuth, elevation),
    ambientShare:
      ambientShare !== undefined && Number.isFinite(ambientShare)
        ? ambientShare
        : DEFAULT_AMBIENT_SHARE,
  }
}

export const ESTIMATE_SUN_VALUE = 'estimate'

// Hypothesis: the tracks' baked colours carry no usable sun. Fitted to the face normals the best directional light explains
// 3 to 11 percent of the brightness inside a material (see real-shadows.md), so the table of stored suns is chosen by hand and
// `sun=estimate` runs the estimator anyway, for experiments.
const DEFAULT_SUN: SunLight = Object.freeze({
  direction: getSunDirection(-60, 55),
  ambientShare: DEFAULT_AMBIENT_SHARE,
})

const getEstimatedSun = (trackKey: string, trackGroup: Group): SunLight | null => {
  const key = getTrackSunKey(trackKey)
  const stored = TRACK_SUN_ESTIMATES[key]
  if (stored !== undefined) return stored
  if (!estimatedSuns.has(key)) {
    const estimate = estimateSun(getTrackTriangles(trackGroup))
    console.info(`sun of ${key}: ${JSON.stringify(estimate)}`)
    estimatedSuns.set(key, estimate)
  }
  return estimatedSuns.get(key) ?? null
}

// The manual sun, else the stored one, else the default (or the estimated one when asked for).
export const getTrackSun = (search: string, trackKey: string, trackGroup: Group): SunLight => {
  const manual = getManualSun(search)
  if (manual !== null) return manual
  if (new URLSearchParams(search).get(SUN_PARAMETER) === ESTIMATE_SUN_VALUE) {
    return getEstimatedSun(trackKey, trackGroup) ?? DEFAULT_SUN
  }
  return TRACK_SUNS[getTrackSunKey(trackKey)] ?? DEFAULT_SUN
}
