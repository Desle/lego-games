import {
  createTestCarBodyWith,
  createTestRacerSet,
  SINGLE_ARITHMETIC,
} from '../racer-fixtures/racer-fixtures.ts'
import { getRacer } from '../racer-state/racer-state.ts'
import {
  createVehicleSkids,
  getSkidCooldownsStepped,
  getSkidsStarted,
  getSkidsStepped,
  getSkidsStopped,
} from './vehicle-skids.ts'

const skids = createVehicleSkids({
  points: [
    { x: 1, y: 2, z: 0 },
    { x: -1, y: 2, z: 0 },
    { x: 1, y: -2, z: 0 },
    { x: -1, y: -2, z: 0 },
  ],
  widths: [1, 2],
})

describe('the vehicle skids', () => {
  it('asks the rear wheels for marks, and every wheel when the car spins', () => {
    // Arrange
    const spinning = 0x2

    // Act
    const normal = getSkidsStarted(skids, 0)
    const spun = getSkidsStarted(skids, spinning)

    // Assert
    expect(normal.flags).toEqual([0, 0, 1, 1])
    expect(spun.flags).toEqual([1, 1, 1, 1])
  })

  it('turns the ground wheels into a cooldown that ends after a second', () => {
    // Arrange
    const marking = { ...skids, flags: [3, 1, 3, 0] }

    // Act
    const stopped = getSkidsStopped(marking)
    const cooled = getSkidCooldownsStepped(getSkidCooldownsStepped(stopped, 600), 600)

    // Assert
    expect(stopped.flags).toEqual([5, 0, 5, 0])
    expect(stopped.releaseCount).toBe(1)
    expect(cooled.flags).toEqual([1, 0, 1, 0])
    expect(cooled.cooldownMilliseconds).toEqual([0, 0, 0, 0])
  })

  it('marks the wheels on the ground on the side the velocity leans to', () => {
    // Arrange
    const racerSet = createTestRacerSet(1)
    const racer = getRacer(racerSet, 0)
    const wheels = racer.carBody.rigidBody.wheels.map((wheel) => ({ ...wheel, isOnGround: true }))
    const body = createTestCarBodyWith({
      wheels,
      velocityDirection: { x: 0, y: 1, z: 0 },
    })
    const started = getSkidsStarted(racer.vehicle.skids, 0)
    const leaning = {
      ...racer,
      carBody: body,
      vehicle: { ...racer.vehicle, skids: started },
    }

    // Act
    const stepped = getSkidsStepped(SINGLE_ARITHMETIC, leaning, 33)

    // Assert
    expect(stepped.step?.index).toBe(1)
    expect(stepped.flags.map((flag) => flag & 1)).toHaveLength(4)
  })
})
