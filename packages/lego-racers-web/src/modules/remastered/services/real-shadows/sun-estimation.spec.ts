import { estimateSun } from './sun-estimation.ts'
import type { SunDirection, TriangleSamples } from './real-shadows.types.ts'

const TRIANGLE_COUNT = 4000
const DEGREES = Math.PI / 180

// Deterministic pseudo-random numbers (a linear congruential generator) so the samples are the same on every run.
const createSequence = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const getBakedSamples = (sun: SunDirection, ambient: number, diffuse: number): TriangleSamples => {
  const next = createSequence(7)
  const normals = new Float32Array(TRIANGLE_COUNT * 3)
  const brightness = new Float32Array(TRIANGLE_COUNT)
  const weights = new Float32Array(TRIANGLE_COUNT).fill(1)
  const groups = new Uint16Array(TRIANGLE_COUNT)
  for (let index = 0; index < TRIANGLE_COUNT; index += 1) {
    const azimuth = next() * 2 * Math.PI
    const height = next() * 2 - 1
    const radius = Math.sqrt(1 - height * height)
    const normal = [radius * Math.cos(azimuth), radius * Math.sin(azimuth), height] as const
    normals.set(normal, index * 3)
    const lit = Math.max(0, normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2])
    // Two materials of different colour: the second is twice as bright.
    groups[index] = index % 2
    brightness[index] = (ambient + diffuse * lit) * (groups[index] === 0 ? 0.5 : 1)
  }
  return { normals, brightness, weights, groups, groupCount: 2 }
}

const getAngleDegrees = (first: SunDirection, second: SunDirection): number =>
  Math.acos(first[0] * second[0] + first[1] * second[1] + first[2] * second[2]) / DEGREES

describe('estimateSun', () => {
  it('finds the direction and the ambient share of a track baked with one sun', () => {
    // Arrange
    const sun: SunDirection = [
      Math.cos(50 * DEGREES) * Math.cos(130 * DEGREES),
      Math.cos(50 * DEGREES) * Math.sin(130 * DEGREES),
      Math.sin(50 * DEGREES),
    ]
    const samples = getBakedSamples(sun, 0.3, 0.7)

    // Act
    const estimate = estimateSun(samples)

    // Assert
    expect(estimate).not.toBeNull()
    expect(getAngleDegrees(estimate?.direction ?? [0, 0, 1], sun)).toBeLessThan(3)
    expect(estimate?.ambientShare).toBeCloseTo(0.3, 1)
    expect(estimate?.fit).toBeGreaterThan(0.95)
  })

  it('finds no sun in a track whose brightness does not follow the normals', () => {
    // Arrange
    const samples = getBakedSamples([0, 0, 1], 0.5, 0)

    // Act
    const estimate = estimateSun(samples)

    // Assert
    expect(estimate).toBeNull()
  })
})
