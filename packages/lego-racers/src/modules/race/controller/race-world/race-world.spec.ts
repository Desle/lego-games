import type { CollisionObject } from '../../../collision/index.ts'
import { getRacer } from '../../../racer/index.ts'
import { createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import {
  changeTrackLogic,
  getContextWithMovedCollisionObjects,
  getFlightRacer,
  getRaceRacerSet,
  getRacerSetAfterProjectileEvents,
  getRacerSetInZone,
  NO_RACE_CONTACTS,
  updateTaggedPositions,
} from './race-world.ts'

describe('projectile events on racers', () => {
  it('makes a racer tumble when a projectile starts it (0x00439570: flag 0x8, spin ended, two-point mode)', () => {
    // Arrange
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)

    // Act
    const changed = getRacerSetAfterProjectileEvents(race.context.arithmetic, racerSet, [
      { type: 'projectiles.racer_tumbling_started', racer: 1 },
    ])

    // Assert
    expect(getRacer(changed, 1).flags & 0x8).toBe(0x8)
    expect(getRacer(changed, 1).carBody.rigidBody.flags & 0x8).toBe(0x8)
    expect(getRacer(changed, 0).flags & 0x8).toBe(0)
  })

  it('reports no route node for a racer that has touched no checkpoint', () => {
    // Arrange
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)

    // Act
    const flightRacer = getFlightRacer(race.context, getRacer(racerSet, 0))

    // Assert
    expect(flightRacer.routeNodeIndex).toBeNull()
    expect(flightRacer.isVehiclePresent).toBe(false)
  })
})

const COLLIDE = 0
const CHECKPOINTS = 1
const START_LINE = 2

const getTaggedRaceSet = (): RaceRacerSet => {
  const state = createFixtureRace()
  const racerSet = getRaceRacerSet(
    Object.freeze({
      ...state,
      collisionObjectNames: ['collide', 'chckpt00', 'startfin'],
      taggedPositionMilliseconds: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    }),
    NO_RACE_CONTACTS
  )
  const trigger: RaceRacerSet['trackLogic']['triggers']['main'][number] = {
    definition: {
      position: [0, 0, 0],
      radius: 1,
      firstInteger: -1,
      isFlag4Set: false,
      isFlag1000Set: false,
      objectName: 'startfin',
      secondInteger: null,
    },
    flags: 0,
    racerMask: 0,
    previousRacerMask: 0,
  }
  return Object.freeze({
    ...racerSet,
    racers: racerSet.racers.map((racer) =>
      Object.freeze({ ...racer, collisionObjectIndices: [COLLIDE, CHECKPOINTS] })
    ),
    trackLogic: Object.freeze({
      ...racerSet.trackLogic,
      triggers: Object.freeze({
        main: Object.freeze([trigger]),
        environment: Object.freeze([]),
      }),
    }),
  })
}

const touchStartLine = (racerSet: RaceRacerSet, racerIndex: number): RaceRacerSet =>
  changeTrackLogic({ ...createFixtureRace().context }, racerSet, (trackLogic) => ({
    state: trackLogic,
    effects: [{ type: 'track.tagged_position_touched', racerIndex, triggerIndex: 0 }],
  }))

describe('tagged positions (0x0045e520, 0x0045e470)', () => {
  it("adds the instance a trigger names to the racer's collision list for 150 ms", () => {
    // Arrange
    const racerSet = getTaggedRaceSet()

    // Act
    const touched = touchStartLine(racerSet, 0)

    // Assert
    expect(getRacer(touched, 0).collisionObjectIndices).toEqual([COLLIDE, CHECKPOINTS, START_LINE])
    expect(getRacer(touched, 1).collisionObjectIndices).toEqual([COLLIDE, CHECKPOINTS])
    expect(touched.taggedPositionMilliseconds[0]?.[START_LINE]).toBe(150)
  })

  it('keeps the instance once in the list however often it is touched', () => {
    // Arrange
    const racerSet = getTaggedRaceSet()

    // Act
    const touched = touchStartLine(touchStartLine(racerSet, 0), 0)

    // Assert
    expect(getRacer(touched, 0).collisionObjectIndices).toEqual([COLLIDE, CHECKPOINTS, START_LINE])
  })

  it('counts the 150 ms down and takes the instance out of the list at 0', () => {
    // Arrange
    const touched = touchStartLine(getTaggedRaceSet(), 0)

    // Act
    const partly = updateTaggedPositions(touched, 100)
    const expired = updateTaggedPositions(partly, 60)

    // Assert
    expect(partly.taggedPositionMilliseconds[0]?.[START_LINE]).toBe(50)
    expect(getRacer(partly, 0).collisionObjectIndices).toContain(START_LINE)
    expect(expired.taggedPositionMilliseconds[0]?.[START_LINE]).toBe(0)
    expect(getRacer(expired, 0).collisionObjectIndices).toEqual([COLLIDE, CHECKPOINTS])
  })

  it('runs a long frame in chunks of at most 255 ms with the same result', () => {
    // Arrange
    const touched = touchStartLine(getTaggedRaceSet(), 1)

    // Act
    const expired = updateTaggedPositions(touched, 700)

    // Assert
    expect(getRacer(expired, 1).collisionObjectIndices).toEqual([COLLIDE, CHECKPOINTS])
    expect(expired.taggedPositionMilliseconds[1]).toEqual([0, 0, 0])
  })

  it('does not hold more than five objects', () => {
    // Arrange
    const racerSet = getTaggedRaceSet()
    const full = Object.freeze({
      ...racerSet,
      racers: racerSet.racers.map((racer) =>
        Object.freeze({ ...racer, collisionObjectIndices: [0, 1, 3, 4, 5] })
      ),
    }) as RaceRacerSet

    // Act
    const touched = touchStartLine(full, 0)

    // Assert
    expect(getRacer(touched, 0).collisionObjectIndices).toEqual([0, 1, 3, 4, 5])
  })
})

describe('zones (0x00464680)', () => {
  it('puts a racer in the zone an event names, shifting its zone history', () => {
    // Arrange
    const racerSet = getTaggedRaceSet()

    // Act
    const inZoneTwo = getRacerSetInZone(racerSet, 0, 2)

    // Assert
    expect(getRacer(inZoneTwo, 0)).toMatchObject({
      zoneCurrent: 2,
      zonePrevious: 0,
      zoneBeforePrevious: 2,
    })
  })
})

describe('barrier hazards (0x0048f030, 0x0048e5a0, 0x0048e600)', () => {
  const getBarrierRaceSet = (): RaceRacerSet => {
    const racerSet = getRaceRacerSet(createFixtureRace(), NO_RACE_CONTACTS)
    const shootme = {
      name: 'shootme',
      flags: 0x11,
      firstInteger: 0,
      secondInteger: 0,
      thirdInteger: 0,
      fourthInteger: 7,
      firstVector: [0, 0, 0],
      secondVector: [0, 0, 0],
      fifthInteger: 0,
      sixthInteger: 0,
      seventhInteger: 0,
      linkedName: null,
      firstFloat: 0,
      secondFloat: 0,
      thirdFloat: 0,
      fourthFloat: 0,
      fifthFloat: 0,
    } as const
    return Object.freeze({
      ...racerSet,
      surfaces: Object.freeze({
        ...racerSet.surfaces,
        trackMaterials: new Map([[shootme.name, shootme]]),
      }),
    })
  }

  const changeBarrier = (racerSet: RaceRacerSet, isSolid: boolean): RaceRacerSet =>
    changeTrackLogic({ ...createFixtureRace().context }, racerSet, (trackLogic) => ({
      state: trackLogic,
      effects: [{ type: 'hazard.collision_object_changed', name: 'shootme', isSolid }],
    }))

  it('opens the named track material to cars and projectiles when the hazard says it is not solid', () => {
    // Arrange
    const racerSet = getBarrierRaceSet()

    // Act
    const opened = changeBarrier(racerSet, false)

    // Assert
    expect(opened.surfaces.trackMaterials.get('shootme')?.flags).toBe(0x30011)
    expect(racerSet.surfaces.trackMaterials.get('shootme')?.flags).toBe(0x11)
  })

  it('closes it again when the hazard says it is solid', () => {
    // Arrange
    const opened = changeBarrier(getBarrierRaceSet(), false)

    // Act
    const closed = changeBarrier(opened, true)

    // Assert
    expect(closed.surfaces.trackMaterials.get('shootme')?.flags).toBe(0x11)
  })

  it('changes nothing for a material the race does not have', () => {
    // Arrange
    const racerSet = getBarrierRaceSet()

    // Act
    const changed = changeTrackLogic(
      { ...createFixtureRace().context },
      racerSet,
      (trackLogic) => ({
        state: trackLogic,
        effects: [{ type: 'hazard.collision_object_changed', name: 'missing', isSolid: false }],
      })
    )

    // Assert
    expect(changed.surfaces).toBe(racerSet.surfaces)
  })
})

const createStillObject = (): CollisionObject =>
  Object.freeze({
    frame: Object.freeze({
      rotation: Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1] as const),
      position: Object.freeze({ x: 0, y: 0, z: 0 }),
    }),
    // The volume is never read by the move.
    volume: Object.freeze({}) as unknown as CollisionObject['volume'],
    materialNames: undefined,
  })

describe('collision objects that follow a bone (0x004639d0)', () => {
  it('moves the named instance to the frame the effect carries and leaves the others', () => {
    // Arrange
    const race = createFixtureRace()
    const context = {
      ...race.context,
      collisionObjects: [createStillObject(), createStillObject()],
    }
    const names = ['object0', 'object1']
    const effect = {
      type: 'track.collision_object_moved',
      name: 'object0',
      frame: {
        position: [1, 2, 3],
        forward: [0, 1, 0],
        up: [0, 0, 1],
      },
    } as const

    // Act
    const moved = getContextWithMovedCollisionObjects(context, names, [effect])

    // Assert
    expect(moved.collisionObjects[0]?.frame.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(moved.collisionObjects[0]?.frame.rotation).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1])
    expect(moved.collisionObjects.slice(1)).toEqual(context.collisionObjects.slice(1))
  })

  it('keeps the context when no instance carries the name', () => {
    // Arrange
    const race = createFixtureRace()

    // Act
    const moved = getContextWithMovedCollisionObjects(
      race.context,
      [],
      [
        {
          type: 'track.collision_object_moved',
          name: 'absent',
          frame: { position: [0, 0, 0], forward: [1, 0, 0], up: [0, 0, 1] },
        },
      ]
    )

    // Assert
    expect(moved).toBe(race.context)
  })
})
