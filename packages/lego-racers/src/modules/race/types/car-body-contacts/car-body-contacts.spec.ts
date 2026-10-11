import type { CarRigidBody, CarWheel, HullContactQuery } from '../../../racer-physics/index.ts'
import type { TrackMaterial } from '../../../track-material/index.ts'
import { createFixtureRacer } from '../race-fixtures/race-fixtures.ts'
import type {
  CarBodyContact,
  SurfaceMaterials,
} from '../surface-materials/surface-materials.types.ts'
import { createCarBodyContactHooks } from './car-body-contacts.ts'

const PASS_THROUGH = 0x10000
const FINISH = 0x40000
const HIT_EVENT = 0x8
const ENTRY_EVENT = 0x2
const LEAVE_EVENT = 0x4
const DRAG = 0x8000
const GRIP = 0x800
const FORCE = 0x40

const createMaterial = (name: string, change: Partial<TrackMaterial>): TrackMaterial => ({
  name,
  flags: 0,
  firstInteger: 0,
  secondInteger: 0,
  thirdInteger: 0,
  fourthInteger: 0,
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
  ...change,
})

const createSurfaces = (materials: readonly TrackMaterial[]): SurfaceMaterials => ({
  trackMaterials: new Map(materials.map((material) => [material.name, material])),
  checkpointIndices: new Map([
    ['0', 0],
    ['1', 1],
  ]),
  checkpointObjectIndex: 1,
})

const getBody = (): CarRigidBody => createFixtureRacer().carBody.rigidBody

const getQuery = (change: Partial<HullContactQuery>): HullContactQuery => ({
  point: { x: 1, y: 2, z: 3 },
  material: undefined,
  collisionObjectIndex: 0,
  triangle: {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ],
    normal: { x: 0, y: -1, z: 0 },
    planeDistance: 0,
  },
  ...change,
})

const record = (): { contacts: CarBodyContact[]; add: (contact: CarBodyContact) => void } => {
  const contacts: CarBodyContact[] = []
  return { contacts, add: (contact) => void contacts.push(contact) }
}

const withWheels = (body: CarRigidBody, change: (wheel: CarWheel, index: number) => CarWheel) =>
  Object.freeze({ ...body, wheels: body.wheels.map(change) })

describe('the car body contact filter (0x0042a830)', () => {
  it('turns a digit-named material of the checkpoint object into a checkpoint touch and no wall', () => {
    // Arrange
    const { contacts, add } = record()
    const hooks = createCarBodyContactHooks(createSurfaces([]), add)

    // Act
    const decision = hooks.decideHullContact(
      getBody(),
      getQuery({ material: '1', collisionObjectIndex: 1 })
    )

    // Assert
    expect(decision.isAccepted).toBe(false)
    expect(contacts).toEqual([
      { type: 'checkpoint_touched', checkpointIndex: 1, direction: { x: 0, y: -1, z: 0 } },
    ])
  })

  it('accepts a contact with a material that has no track-material entry', () => {
    // Arrange
    const { contacts, add } = record()
    const hooks = createCarBodyContactHooks(createSurfaces([]), add)

    // Act
    const decision = hooks.decideHullContact(getBody(), getQuery({ material: 'road' }))

    // Assert
    expect(decision.isAccepted).toBe(true)
    expect(contacts).toEqual([])
  })

  it('lets the hull pass a material flagged 0x10000 and raises its event (flag 0x8)', () => {
    // Arrange
    const { contacts, add } = record()
    const surfaces = createSurfaces([
      createMaterial('out', { flags: PASS_THROUGH | HIT_EVENT, thirdInteger: 7 }),
    ])
    const hooks = createCarBodyContactHooks(surfaces, add)

    // Act
    const decision = hooks.decideHullContact(getBody(), getQuery({ material: 'out' }))

    // Assert
    expect(decision.isAccepted).toBe(false)
    expect(contacts).toEqual([{ type: 'surface_hit', identifier: 7, point: { x: 1, y: 2, z: 3 } }])
  })

  it('reports a material flagged 0x40000 as the finish and still treats it as a wall', () => {
    // Arrange
    const { contacts, add } = record()
    const hooks = createCarBodyContactHooks(
      createSurfaces([createMaterial('line', { flags: FINISH })]),
      add
    )

    // Act
    const decision = hooks.decideHullContact(getBody(), getQuery({ material: 'line' }))

    // Assert
    expect(decision.isAccepted).toBe(true)
    expect(contacts).toEqual([{ type: 'finish_touched' }])
  })
})

describe("the wheels' surface values (0x0042a900)", () => {
  const grass = createMaterial('grass', {
    flags: DRAG | GRIP | FORCE,
    fifthFloat: 20,
    firstFloat: 0.7,
    secondVector: [1, 2, 3],
  })

  it('gives a wheel on the ground the values of its material and the defaults for the rest', () => {
    // Arrange
    const { add } = record()
    const hooks = createCarBodyContactHooks(createSurfaces([grass]), add)
    const body = withWheels(getBody(), (wheel, index) =>
      index === 0
        ? { ...wheel, isOnGround: true, material: 'grass', previousMaterial: 'grass' }
        : { ...wheel, material: undefined, previousMaterial: undefined }
    )

    // Act
    const after = hooks.afterPass(body)

    // Assert
    const [first, second] = after.wheels
    expect(first?.surfaceDrag).toBe(20)
    expect(first?.surfaceGrip).toBeCloseTo(0.7, 6)
    expect(first?.surfaceSkidGrip).toBe(0.25)
    expect(first?.grip).toBe(3)
    expect(first?.surfaceForce).toEqual({ x: 1, y: 2, z: 3 })
    expect(second?.surfaceDrag).toBe(0)
    expect(second?.surfaceGrip).toBe(0.5)
  })

  it('uses the defaults when the wheel is off the ground or the body ignores surfaces', () => {
    // Arrange
    const { add } = record()
    const hooks = createCarBodyContactHooks(createSurfaces([grass]), add)
    const airborne = withWheels(getBody(), (wheel) => ({
      ...wheel,
      isOnGround: false,
      material: 'grass',
      previousMaterial: 'grass',
    }))
    const ignoring = Object.freeze({
      ...withWheels(getBody(), (wheel) => ({
        ...wheel,
        isOnGround: true,
        material: 'grass',
        previousMaterial: 'grass',
      })),
      flags: 0x100000,
    })

    // Act
    const afterAirborne = hooks.afterPass(airborne)
    const afterIgnoring = hooks.afterPass(ignoring)

    // Assert
    expect(afterAirborne.wheels.every((wheel) => wheel.surfaceDrag === 0)).toBe(true)
    expect(afterIgnoring.wheels.every((wheel) => wheel.surfaceDrag === 0)).toBe(true)
  })

  it('announces a new material once, even when two wheels enter it together', () => {
    // Arrange
    const { contacts, add } = record()
    const hooks = createCarBodyContactHooks(
      createSurfaces([
        createMaterial('in', {
          flags: ENTRY_EVENT | LEAVE_EVENT,
          firstInteger: 5,
          secondInteger: 6,
        }),
      ]),
      add
    )
    const body = withWheels(getBody(), (wheel, index) => ({
      ...wheel,
      isOnGround: true,
      material: index < 2 ? 'in' : undefined,
      previousMaterial: undefined,
    }))

    // Act
    hooks.afterPass(body)

    // Assert
    expect(contacts.map((contact) => contact.type)).toEqual(['surface_entered'])
  })

  it('announces the leaving of a material only when no wheel stays on it', () => {
    // Arrange
    const { contacts, add } = record()
    const hooks = createCarBodyContactHooks(
      createSurfaces([
        createMaterial('in', {
          flags: ENTRY_EVENT | LEAVE_EVENT,
          firstInteger: 5,
          secondInteger: 6,
        }),
      ]),
      add
    )
    const oneStays = withWheels(getBody(), (wheel, index) => ({
      ...wheel,
      isOnGround: true,
      material: index === 0 ? 'in' : undefined,
      previousMaterial: 'in',
    }))
    const noneStays = withWheels(getBody(), (wheel) => ({
      ...wheel,
      isOnGround: true,
      material: undefined,
      previousMaterial: 'in',
    }))

    // Act
    hooks.afterPass(oneStays)
    const keptCount = contacts.length
    hooks.afterPass(noneStays)

    // Assert
    expect(keptCount).toBe(0)
    expect(contacts.map((contact) => contact.type)).toEqual(['surface_left'])
    expect(contacts[0]).toMatchObject({ identifier: 6 })
  })
})
