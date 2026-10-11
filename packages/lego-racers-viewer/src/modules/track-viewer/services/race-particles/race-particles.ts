import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import { PARTICLE_CAPACITY } from '@lego-games/lego-racers/emitter'
import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'
import type { RaceParticles } from './race-particles.types.ts'

// Ten emitters of the common pool and up to fourteen of the track's, sixteen particles each.
const MAXIMUM_PARTICLES = 24 * PARTICLE_CAPACITY
const POINT_SIZE = 3
const POINT_COLOR = 0xfff2c0

// The live particles of the race's emitter pools as points. Each particle is at its system's frame plus its own
// offset (0x00412760); the engine's sprite materials are not drawn, so a particle is a small light square.
export const createRaceParticles = (): RaceParticles => {
  const positions = new Float32Array(MAXIMUM_PARTICLES * 3)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setDrawRange(0, 0)
  const material = new PointsMaterial({
    color: POINT_COLOR,
    size: POINT_SIZE,
    sizeAttenuation: true,
    depthWrite: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  const update = (pools: readonly (EmitterPool | null)[]) => {
    let count = 0
    for (const pool of pools) {
      for (const instance of pool?.instances ?? []) {
        const { framePosition, particles } = instance.system
        for (const particle of particles) {
          if (count >= MAXIMUM_PARTICLES) break
          positions[count * 3] = framePosition.x + particle.position.x
          positions[count * 3 + 1] = framePosition.y + particle.position.y
          positions[count * 3 + 2] = framePosition.z + particle.position.z
          count += 1
        }
      }
    }
    geometry.setDrawRange(0, count)
    ;(geometry.getAttribute('position') as BufferAttribute).needsUpdate = true
  }
  return Object.freeze({
    points,
    update,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  })
}
