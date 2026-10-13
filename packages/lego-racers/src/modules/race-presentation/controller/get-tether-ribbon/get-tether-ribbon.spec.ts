import { BallisticFlightState, createBallisticFlight } from '../../../projectiles/index.ts'
import type { BallisticFlight, GrappleHook } from '../../../projectiles/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getTetherRibbon, TETHER_MATERIAL_NAME } from './get-tether-ribbon.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const OWNER: Vector3 = { x: 0, y: 0, z: 0 }

const getHook = (
  flight: Partial<BallisticFlight>,
  hook: Partial<GrappleHook> = {}
): GrappleHook => ({
  flight: { ...createBallisticFlight(), ...flight },
  hookTarget: { x: 0, y: 0, z: 0 },
  isRetracting: false,
  isHookArrived: false,
  tension: 0,
  ropeOwnerPosition: OWNER,
  ...hook,
})

describe('getTetherRibbon (0x00444490)', () => {
  it('lays the rope of a hook in flight from 3 above the owner to the hook, in five segments', () => {
    // Arrange
    const hook = getHook({
      state: BallisticFlightState.FLYING,
      framePosition: { x: 0, y: 50, z: 10 },
      elapsedMilliseconds: 500,
      durationMilliseconds: 1000,
      gravity: -90,
      launchVelocityZ: 40,
      startPosition: { x: 0, y: 0, z: 3 },
    })

    // Act
    const ribbon = getTetherRibbon(SINGLE, OWNER, hook)

    // Assert
    expect(ribbon?.materialName).toBe(TETHER_MATERIAL_NAME)
    expect(ribbon?.isFacingCamera).toBe(false)
    expect(ribbon?.skin.bones).toHaveLength(5)
    expect(ribbon?.skin.figure.position).toEqual({ x: 0, y: 0, z: 3 })
  })

  it('lays the rope of a retracting hook to the point it has reached', () => {
    // Arrange
    const hook = getHook(
      { state: BallisticFlightState.HIT_GROUND },
      { isRetracting: true, hookTarget: { x: 0, y: 40, z: 3 }, tension: 0.5 }
    )

    // Act
    const ribbon = getTetherRibbon(SINGLE, OWNER, hook)

    // Assert
    expect(ribbon?.skin.bones).toHaveLength(5)
  })

  it('lays no rope for a hook that ended its flight on the track', () => {
    // Arrange / Act
    const ribbon = getTetherRibbon(
      SINGLE,
      OWNER,
      getHook({ state: BallisticFlightState.HIT_GROUND })
    )

    // Assert
    expect(ribbon).toBeNull()
  })

  it('lays the rope of a latched hook straight once the tension is 1', () => {
    // Arrange
    const hook = getHook(
      {
        state: BallisticFlightState.TOUCHED_RACER,
        framePosition: { x: 0, y: 50, z: 13 },
        durationMilliseconds: 1000,
      },
      { tension: 1, isHookArrived: true }
    )

    // Act
    const ribbon = getTetherRibbon(SINGLE, OWNER, hook)

    // Assert: the rings between the owner (z 3) and the hook (z 13) climb in a straight line.
    const heights = ribbon?.skin.rings.map((ring) => ring.locals[1]?.z ?? 0) ?? []
    expect(heights.length).toBeGreaterThan(5)
    expect(ribbon?.skin.bones).toHaveLength(5)
  })
})
