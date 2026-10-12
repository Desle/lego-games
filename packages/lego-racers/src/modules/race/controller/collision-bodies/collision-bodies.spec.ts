import { HazardKeyword, HazardLifecycle } from '../../../hazard/index.ts'
import type { HazardInstance } from '../../../hazard/index.ts'
import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import { getRacerSetWithCollisionBodies } from './collision-bodies.ts'

const BODY = Object.freeze({
  sphere: { centre: ZERO_VECTOR3, radius: 15 },
  box: {
    rotation: IDENTITY_MATRIX3,
    centre: ZERO_VECTOR3,
    dimensions: { x: 30, y: 12, z: 14 },
    scale: 1,
  },
  linearVelocity: ZERO_VECTOR3,
  inverseMass: 0.00005,
})

const createHammer = (lifecycle: number): HazardInstance =>
  Object.freeze({
    definition: {
      keyword: HazardKeyword.HAZARD_3E,
      name: 'rkhamm02',
      integer: 53,
      float: 0,
      vector: [30, 12, 14],
    },
    identifier: 53,
    lifecycle,
    data: {
      keyword: HazardKeyword.HAZARD_3E,
      instance: null,
      isFollowingAxes: true,
      posedClip: null,
      body: BODY,
    },
  })

const createRacerSet = (lifecycle: number, change: Partial<RaceRacerSet> = {}): RaceRacerSet =>
  ({
    racers: [{}, {}],
    collisionOrder: [1, 0],
    collisionBodies: [],
    trackLogic: { hazards: { instances: [createHammer(lifecycle)] } },
    ...change,
  }) as unknown as RaceRacerSet

describe('getRacerSetWithCollisionBodies, 0x0048be00 and 0x0048be50', () => {
  it('puts a hammer that began at the head of the racers list, after the racer nodes', () => {
    // Arrange
    const racerSet = createRacerSet(HazardLifecycle.ACTIVE)

    // Act
    const result = getRacerSetWithCollisionBodies(racerSet)

    // Assert
    expect(result.collisionOrder).toEqual([2, 1, 0])
    expect(result.collisionBodies).toEqual([{ owner: 0, isActive: true, body: BODY }])
  })

  it('leaves a hammer that has not begun out of the list', () => {
    // Arrange
    const racerSet = createRacerSet(HazardLifecycle.IDLE)

    // Act
    const result = getRacerSetWithCollisionBodies(racerSet)

    // Assert
    expect(result).toBe(racerSet)
  })

  it('takes a hammer that ended out of the list and keeps its node number', () => {
    // Arrange
    const began = getRacerSetWithCollisionBodies(createRacerSet(HazardLifecycle.ACTIVE))
    const ended = createRacerSet(HazardLifecycle.IDLE, {
      collisionOrder: began.collisionOrder,
      collisionBodies: began.collisionBodies,
    })

    // Act
    const result = getRacerSetWithCollisionBodies(ended)

    // Assert
    expect(result.collisionOrder).toEqual([1, 0])
    expect(result.collisionBodies[0]?.isActive).toBe(false)
  })
})
