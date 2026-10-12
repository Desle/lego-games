import { getSunDirection } from './sun-direction.ts'
import type {
  Candidate,
  GroupSums,
  SunDirection,
  SunEstimate,
  SunFit,
  TriangleSamples,
} from './real-shadows.types.ts'

const COARSE_STEP_DEGREES = 6
const FINE_STEP_DEGREES = 0.75
const FINE_RANGE_DEGREES = 6
const MINIMUM_ELEVATION_DEGREES = 8
const MAXIMUM_ELEVATION_DEGREES = 90
const MAXIMUM_SEARCH_TRIANGLES = 24000
const MINIMUM_DIFFUSE_SHARE = 0.02
const MINIMUM_AMBIENT_SHARE = 0.25

const createGroupSums = (groupCount: number): GroupSums => ({
  weight: new Float64Array(groupCount),
  lit: new Float64Array(groupCount),
  brightness: new Float64Array(groupCount),
  litLit: new Float64Array(groupCount),
  litBrightness: new Float64Array(groupCount),
  brightnessBrightness: new Float64Array(groupCount),
})

// Least squares of the baked brightness against max(0, normal . direction) inside each material (a material's colour scales
// all of its brightness, so each is divided by its material's mean): brightness = ambient + diffuse * lit.
export const getSunFit = (samples: TriangleSamples, direction: SunDirection): SunFit => {
  const [x, y, z] = direction
  const sums = createGroupSums(samples.groupCount)
  for (let index = 0; index < samples.brightness.length; index += 1) {
    const group = samples.groups[index] ?? 0
    const weight = samples.weights[index] ?? 0
    const lit = Math.max(
      0,
      (samples.normals[index * 3] ?? 0) * x +
        (samples.normals[index * 3 + 1] ?? 0) * y +
        (samples.normals[index * 3 + 2] ?? 0) * z
    )
    const brightness = samples.brightness[index] ?? 0
    sums.weight[group] = (sums.weight[group] ?? 0) + weight
    sums.lit[group] = (sums.lit[group] ?? 0) + weight * lit
    sums.brightness[group] = (sums.brightness[group] ?? 0) + weight * brightness
    sums.litLit[group] = (sums.litLit[group] ?? 0) + weight * lit * lit
    sums.litBrightness[group] = (sums.litBrightness[group] ?? 0) + weight * lit * brightness
    sums.brightnessBrightness[group] =
      (sums.brightnessBrightness[group] ?? 0) + weight * brightness * brightness
  }
  let litVariance = 0
  let covariance = 0
  let brightnessVariance = 0
  let totalWeight = 0
  let meanLit = 0
  for (let group = 0; group < samples.groupCount; group += 1) {
    const weight = sums.weight[group] ?? 0
    const meanBrightness = weight > 0 ? (sums.brightness[group] ?? 0) / weight : 0
    if (!(weight > 0) || !(meanBrightness > 0)) continue
    // Divided by the material's mean, the variance and covariance scale by 1 / mean squared and 1 / mean.
    const scale = 1 / meanBrightness
    const groupLit = sums.lit[group] ?? 0
    litVariance += (sums.litLit[group] ?? 0) - (groupLit * groupLit) / weight
    covariance +=
      ((sums.litBrightness[group] ?? 0) - (groupLit * (sums.brightness[group] ?? 0)) / weight) *
      scale
    brightnessVariance +=
      ((sums.brightnessBrightness[group] ?? 0) -
        ((sums.brightness[group] ?? 0) * (sums.brightness[group] ?? 0)) / weight) *
      scale *
      scale
    totalWeight += weight
    meanLit += groupLit
  }
  if (!(litVariance > 0) || !(brightnessVariance > 0)) return { ambient: 0, diffuse: 0, fit: 0 }
  const diffuse = covariance / litVariance
  // Every material's relative brightness averages 1.
  const ambient = 1 - (diffuse * meanLit) / totalWeight
  return { ambient, diffuse, fit: (covariance * covariance) / (litVariance * brightnessVariance) }
}

const getSearchSamples = (samples: TriangleSamples): TriangleSamples => {
  const count = samples.brightness.length
  if (count <= MAXIMUM_SEARCH_TRIANGLES) return samples
  const stride = Math.ceil(count / MAXIMUM_SEARCH_TRIANGLES)
  const kept = Math.ceil(count / stride)
  const normals = new Float32Array(kept * 3)
  const brightness = new Float32Array(kept)
  const weights = new Float32Array(kept)
  const groups = new Uint16Array(kept)
  for (let target = 0; target < kept; target += 1) {
    const source = target * stride
    normals.set(samples.normals.subarray(source * 3, source * 3 + 3), target * 3)
    brightness[target] = samples.brightness[source] ?? 0
    weights[target] = samples.weights[source] ?? 0
    groups[target] = samples.groups[source] ?? 0
  }
  return { normals, brightness, weights, groups, groupCount: samples.groupCount }
}

const getBestCandidate = (
  samples: TriangleSamples,
  azimuths: readonly number[],
  elevations: readonly number[]
): Candidate | null => {
  let best: Candidate | null = null
  for (const azimuthDegrees of azimuths) {
    for (const elevationDegrees of elevations) {
      const fit = getSunFit(samples, getSunDirection(azimuthDegrees, elevationDegrees))
      // A light adds brightness where it shines: a negative or vanishing diffuse term is a mirror image.
      if (fit.diffuse <= 0 || fit.diffuse < MINIMUM_DIFFUSE_SHARE * (fit.ambient + fit.diffuse)) {
        continue
      }
      if (best === null || fit.fit > best.fit.fit) best = { azimuthDegrees, elevationDegrees, fit }
    }
  }
  return best
}

const getRange = (start: number, end: number, step: number): readonly number[] =>
  Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, index) => start + index * step)

// The sun a track was baked with, from its prelit triangles: the direction above the horizon whose clamped cosine explains the
// baked brightness best, and the brightness of a surface facing away relative to one facing the sun. Null when no light explains it.
export const estimateSun = (samples: TriangleSamples): SunEstimate | null => {
  const searched = getSearchSamples(samples)
  const coarse = getBestCandidate(
    searched,
    getRange(0, 360 - COARSE_STEP_DEGREES, COARSE_STEP_DEGREES),
    getRange(MINIMUM_ELEVATION_DEGREES, MAXIMUM_ELEVATION_DEGREES, COARSE_STEP_DEGREES)
  )
  if (coarse === null) return null
  const fine = getBestCandidate(
    samples,
    getRange(
      coarse.azimuthDegrees - FINE_RANGE_DEGREES,
      coarse.azimuthDegrees + FINE_RANGE_DEGREES,
      FINE_STEP_DEGREES
    ),
    getRange(
      Math.max(MINIMUM_ELEVATION_DEGREES, coarse.elevationDegrees - FINE_RANGE_DEGREES),
      Math.min(MAXIMUM_ELEVATION_DEGREES, coarse.elevationDegrees + FINE_RANGE_DEGREES),
      FINE_STEP_DEGREES
    )
  )
  const best = fine ?? coarse
  const facingBrightness = best.fit.ambient + best.fit.diffuse
  return Object.freeze({
    direction: getSunDirection(best.azimuthDegrees, best.elevationDegrees),
    ambientShare: Math.min(1, Math.max(MINIMUM_AMBIENT_SHARE, best.fit.ambient / facingBrightness)),
    fit: best.fit.fit,
    triangleCount: samples.brightness.length,
  })
}
