import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import {
  BallisticFlightState,
  createBallisticFlight,
} from '../ballistic-flight/ballistic-flight.ts'
import type { LineProbe } from '../projectiles.types.ts'
import type { RouteNode } from '../route-movement/route-movement.types.ts'
import {
  advanceHomingFlight,
  createHomingFlight,
  getHomingVelocity,
  retargetHomingFlight,
} from './homing-flight.ts'
import type { HomingFlight, HomingTarget } from './homing-flight.types.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const f = Math.fround
const ZERO: Vector3 = { x: 0, y: 0, z: 0 }
const MISS: LineProbe = () => null
const SECONDS = f(16 * f(0.001))

const getHoming = (
  overrides: Partial<HomingFlight> = {},
  targetRacer: number | null = null
): HomingFlight => ({
  ...createHomingFlight(
    SINGLE,
    {
      ...createBallisticFlight(),
      state: BallisticFlightState.FLYING,
      maximumDurationMilliseconds: 5500,
      velocityX: 170,
      horizontalSpeed: 170,
      shooterRacer: 0,
      targetRacer,
    },
    { x: 1, y: 0, z: 0 },
    null,
    []
  ),
  ...overrides,
})

describe('advanceHomingFlight (0x00423a20)', () => {
  it('flies straight at a racer within 60 units at the launch speed and corkscrews round the heading', () => {
    // Arrange: the racer's frame is 5 below the aim point.
    const homing = getHoming({}, 1)

    // Act
    const advance = advanceHomingFlight(SINGLE, MISS, homing, 16, { x: 40, y: 0, z: -5 })

    // Assert
    expect(advance.result).toBe(BallisticFlightState.FLYING)
    expect(advance.homing.velocity).toEqual({ x: 170, y: 0, z: 0 })
    expect(advance.homing.position).toEqual({ x: f(SECONDS * 170), y: 0, z: 0 })
    expect(advance.homing.flight.targetPosition).toEqual({ x: 40, y: 0, z: 0 })
    const wobble = f(6 * SECONDS)
    expect(advance.homing.wobbleAmplitude).toBe(wobble)
    expect(advance.homing.flight.framePosition.y).toBeCloseTo(Math.sin(f(10 * SECONDS)) * wobble, 6)
    expect(advance.homing.flight.framePosition.z).toBeCloseTo(Math.cos(f(10 * SECONDS)) * wobble, 6)
    expect(advance.homing.flight.framePosition.x).toBe(advance.homing.position.x)
  })

  it('has arrived within 3 units of the aim point and ends there (0x00423c19)', () => {
    // Arrange / Act
    const advance = advanceHomingFlight(SINGLE, MISS, getHoming({}, 1), 16, { x: 2, y: 0, z: -5 })

    // Assert
    expect(advance.result).toBe(BallisticFlightState.ENDED)
    expect(advance.homing.flight.endPosition).toEqual({ x: 2, y: 0, z: 0 })
    expect(advance.homing.flight.framePosition).toEqual({ x: 2, y: 0, z: 0 })
    expect(getHomingVelocity(advance.homing)).toEqual({ x: 170, y: 0, z: 0 })
  })

  it('ends at the target when the step would carry it past', () => {
    // Arrange: 4 units away is outside 3 but one step of 2.72 plus its heading change is not past; use a long step.
    const advance = advanceHomingFlight(SINGLE, MISS, getHoming({}, 1), 100, { x: 10, y: 0, z: -5 })

    // Assert
    expect(advance.result).toBe(BallisticFlightState.ENDED)
    expect(advance.homing.flight.endPosition).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('follows its heading at the flight speed when there is no target and clears the ground by 6', () => {
    // Arrange: ground 10 below; heading +y.
    const ground: LineProbe = () => ({
      point: { x: 0, y: 0, z: -10 },
      normal: { x: 0, y: 0, z: 1 },
    })
    const homing = getHoming({ heading: { x: 0, y: 1, z: 0 } })

    // Act
    const advance = advanceHomingFlight(SINGLE, ground, homing, 16, null)

    // Assert: it sinks 6 a second towards the 6-above-ground floor at -4.
    expect(advance.homing.velocity).toEqual({ x: 0, y: 170, z: 0 })
    expect(advance.homing.position.y).toBe(f(170 * SECONDS))
    expect(advance.homing.position.z).toBe(f(0 - f(6 * SECONDS)))
  })

  it('is lifted to 6 above the ground when it is below it', () => {
    // Arrange: ground at 0, rocket at -3.
    const ground: LineProbe = () => ({ point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } })
    const homing = getHoming({ position: { x: 0, y: 0, z: -3 } })

    // Act
    const advance = advanceHomingFlight(SINGLE, ground, homing, 16, null)

    // Assert
    expect(advance.homing.position.z).toBe(6)
  })

  it('steers to the ground point of its route node while that is ahead, and forgets it once passed', () => {
    // Arrange
    const ahead = getHoming({ isGroundPointKnown: true, groundPoint: { x: 100, y: 0, z: 0 } })
    const passed = getHoming({ isGroundPointKnown: true, groundPoint: { x: -100, y: 0, z: 0 } })

    // Act
    const toward = advanceHomingFlight(SINGLE, MISS, ahead, 16, null)
    const behind = advanceHomingFlight(SINGLE, MISS, passed, 16, null)

    // Assert
    expect(toward.homing.heading).toEqual({ x: 1, y: 0, z: 0 })
    expect(toward.homing.isGroundPointKnown).toBe(true)
    expect(behind.homing.isGroundPointKnown).toBe(false)
  })

  it('stops where the probe hits the track (state 3)', () => {
    // Arrange
    const wall: LineProbe = () => ({ point: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 0, z: 1 } })

    // Act
    const advance = advanceHomingFlight(SINGLE, wall, getHoming(), 16, null)

    // Assert
    expect(advance.result).toBe(BallisticFlightState.HIT_GROUND)
    expect(advance.homing.flight.endPosition).toEqual({ x: 1, y: 2, z: 3 })
    expect(advance.homing.flight.hitNormal).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('ends at its maximum duration', () => {
    // Arrange / Act
    const advance = advanceHomingFlight(SINGLE, MISS, getHoming(), 5500, null)

    // Assert
    expect(advance.result).toBe(BallisticFlightState.ENDED)
  })
})

describe('retargetHomingFlight (0x00423640)', () => {
  const window = {
    minimumDistanceSquared: 100,
    maximumDistanceSquared: 160000,
    minimumCosine: f(0.7071),
  }
  const getTarget = (x: number, overrides: Partial<HomingTarget> = {}): HomingTarget => ({
    position: { x, y: 0, z: 0 },
    isStruckByLightning: false,
    isShieldedOrWarping: false,
    ...overrides,
  })

  it('takes the first racer in the cone that is not the shooter, struck or shielded', () => {
    // Arrange: racer 0 is the shooter, 1 is struck, 2 is in range.
    const targets = [getTarget(0), getTarget(200, { isStruckByLightning: true }), getTarget(300)]

    // Act
    const retargeted = retargetHomingFlight(SINGLE, MISS, getHoming(), 16, {
      targets,
      route: [],
      window,
    })

    // Assert
    expect(retargeted.flight.targetRacer).toBe(2)
    expect(retargeted.retargetMilliseconds).toBe(0)
  })

  it('keeps a valid target until a second has passed', () => {
    // Arrange
    const targets = [getTarget(0), getTarget(200), getTarget(300)]
    const homing = getHoming({ retargetMilliseconds: 500 }, 2)

    // Act
    const kept = retargetHomingFlight(SINGLE, MISS, homing, 400, { targets, route: [], window })
    const chosen = retargetHomingFlight(SINGLE, MISS, homing, 501, { targets, route: [], window })

    // Assert
    expect(kept.flight.targetRacer).toBe(2)
    expect(kept.retargetMilliseconds).toBe(900)
    expect(chosen.flight.targetRacer).toBe(1)
  })

  it('has no target when the cone is empty', () => {
    // Arrange / Act
    const retargeted = retargetHomingFlight(SINGLE, MISS, getHoming({}, 1), 16, {
      targets: [getTarget(0)],
      route: [],
      window,
    })

    // Assert
    expect(retargeted.flight.targetRacer).toBeNull()
  })

  it('finds the ground below the route node it follows, 6 above the hit (0x004238d9)', () => {
    // Arrange: a node 100 ahead whose plane the rocket is 20 in front of.
    const node: RouteNode = {
      normal: { x: -1, y: 0, z: 0 },
      planeOffset: 80,
      position: { x: 100, y: 0, z: 0 },
      nextIndex: 0,
    }
    const ground: LineProbe = () => ({
      point: { x: 100, y: 0, z: -20 },
      normal: { x: 0, y: 0, z: 1 },
    })
    const homing = getHoming({ routeNodeIndex: 0 }, 1)

    // Act
    const retargeted = retargetHomingFlight(SINGLE, ground, homing, 16, {
      targets: [getTarget(0), getTarget(200)],
      route: [node],
      window,
    })

    // Assert
    expect(retargeted.isGroundPointKnown).toBe(true)
    expect(retargeted.groundPoint).toEqual({ x: 100, y: 0, z: -14 })
    expect(retargeted.routeNodeIndex).toBe(0)
  })

  it('drops a route node more than 300 units away', () => {
    // Arrange: the rocket is behind the node's plane, so it moves on to the next node, 400 away.
    const nodes: RouteNode[] = [
      {
        normal: { x: 1, y: 0, z: 0 },
        planeOffset: 0,
        position: { x: -5, y: 0, z: 0 },
        nextIndex: 1,
      },
      {
        normal: { x: 1, y: 0, z: 0 },
        planeOffset: 0,
        position: { x: 400, y: 0, z: 0 },
        nextIndex: 0,
      },
    ]
    const homing = getHoming({ routeNodeIndex: 0 }, 1)

    // Act
    const retargeted = retargetHomingFlight(SINGLE, MISS, homing, 16, {
      targets: [getTarget(0), getTarget(200)],
      route: nodes,
      window,
    })

    // Assert
    expect(retargeted.routeNodeIndex).toBeNull()
    expect(retargeted.isGroundPointKnown).toBe(false)
  })
})

describe('createHomingFlight (0x00423980)', () => {
  const flight = { ...createBallisticFlight(), framePosition: { x: 1, y: 2, z: 3 } }
  const node: RouteNode = {
    normal: { x: 1, y: 0, z: 0 },
    planeOffset: 0,
    position: ZERO,
    nextIndex: 0,
  }

  it('starts at the frame position with the wobble set to 4 and 10', () => {
    // Arrange / Act
    const homing = createHomingFlight(SINGLE, flight, { x: 0, y: 1, z: 0 }, null, [])

    // Assert
    expect(homing).toMatchObject({
      position: { x: 1, y: 2, z: 3 },
      wobbleMaximumAmplitude: 4,
      wobbleRate: 10,
      heading: { x: 0, y: 1, z: 0 },
      routeNodeIndex: null,
    })
  })

  it("keeps the shooter's route node only when the heading does not point through its plane", () => {
    // Arrange / Act
    const kept = createHomingFlight(SINGLE, flight, { x: -1, y: 0, z: 0 }, 0, [node])
    const dropped = createHomingFlight(SINGLE, flight, { x: 1, y: 0, z: 0 }, 0, [node])

    // Assert
    expect(kept.routeNodeIndex).toBe(0)
    expect(dropped.routeNodeIndex).toBeNull()
  })
})
