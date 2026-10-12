import type { HullContactQuery } from '../../../racer-physics/index.ts'
import type { TrackMaterial } from '../../../track-material/index.ts'
import { createCarBodyContactHooks } from '../car-body-contacts/car-body-contacts.ts'
import { createFixtureRacer } from '../race-fixtures/race-fixtures.ts'
import { getProbeSurface, getSurfacesWithBarrierOpen } from './surface-materials.ts'
import type { SurfaceMaterials } from './surface-materials.types.ts'

const SIGNAL = 0x10
const CAR_PASS_THROUGH = 0x10000
const PROJECTILE_PASS_THROUGH = 0x20000
const BARRIER = 0x1
// RACEC0R1.TMB: shootme has flags 0x11 and signal 7.
const BARRIER_SIGNAL = 7

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

const createSurfaces = (): SurfaceMaterials => ({
  trackMaterials: new Map(
    [
      createMaterial('road', { flags: BARRIER }),
      createMaterial('shootme', { flags: BARRIER | SIGNAL, fourthInteger: BARRIER_SIGNAL }),
      createMaterial('go_thru', { flags: BARRIER | PROJECTILE_PASS_THROUGH }),
    ].map((material) => [material.name, material])
  ),
  checkpointIndices: new Map(),
  checkpointObjectIndex: null,
})

const getHullQuery = (material: string): HullContactQuery => ({
  point: { x: 1, y: 2, z: 3 },
  material,
  collisionObjectIndex: 0,
  triangle: {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ],
    normal: { x: 0, y: 0, z: 1 },
    planeDistance: 0,
  },
})

describe('getProbeSurface', () => {
  it('is solid and silent for a material without an entry (0x0041f730, property 0)', () => {
    // Arrange
    const surfaces = createSurfaces()

    // Act
    const surface = getProbeSurface(surfaces, 'unknown')

    // Assert
    expect(surface).toEqual({ isPassThrough: false, signalIdentifier: null })
  })

  it('takes the signal of an entry with flag 0x10 from its +0x18', () => {
    // Arrange
    const surfaces = createSurfaces()

    // Act
    const surface = getProbeSurface(surfaces, 'shootme')

    // Assert
    expect(surface).toEqual({ isPassThrough: false, signalIdentifier: BARRIER_SIGNAL })
  })

  it('lets projectiles through an entry with flag 0x20000', () => {
    // Arrange
    const surfaces = createSurfaces()

    // Act
    const surface = getProbeSurface(surfaces, 'go_thru')

    // Assert
    expect(surface).toEqual({ isPassThrough: true, signalIdentifier: null })
  })
})

describe('getSurfacesWithBarrierOpen', () => {
  it('sets flags 0x10000 and 0x20000 of the named entry and nothing else (0x0048f030)', () => {
    // Arrange
    const surfaces = createSurfaces()

    // Act
    const opened = getSurfacesWithBarrierOpen(surfaces, 'shootme', true)

    // Assert
    expect(opened.trackMaterials.get('shootme')?.flags).toBe(
      BARRIER | SIGNAL | CAR_PASS_THROUGH | PROJECTILE_PASS_THROUGH
    )
    expect(opened.trackMaterials.get('road')).toBe(surfaces.trackMaterials.get('road'))
    expect(surfaces.trackMaterials.get('shootme')?.flags).toBe(BARRIER | SIGNAL)
    expect([...opened.trackMaterials.keys()]).toEqual(['road', 'shootme', 'go_thru'])
  })

  it('clears both flags again when the barrier closes (0x0048e600)', () => {
    // Arrange
    const opened = getSurfacesWithBarrierOpen(createSurfaces(), 'shootme', true)

    // Act
    const closed = getSurfacesWithBarrierOpen(opened, 'shootme', false)

    // Assert
    expect(closed.trackMaterials.get('shootme')?.flags).toBe(BARRIER | SIGNAL)
  })

  it('keeps the surfaces when the entry is unknown or already in that state', () => {
    // Arrange
    const surfaces = createSurfaces()

    // Act
    const unknown = getSurfacesWithBarrierOpen(surfaces, 'missing', true)
    const unchanged = getSurfacesWithBarrierOpen(surfaces, 'shootme', false)

    // Assert
    expect(unknown).toBe(surfaces)
    expect(unchanged).toBe(surfaces)
  })

  it('lets the car hull through only once the barrier is open (0x0042a830)', () => {
    // Arrange
    const closed = createSurfaces()
    const opened = getSurfacesWithBarrierOpen(closed, 'shootme', true)
    const body = createFixtureRacer().carBody.rigidBody

    // Act
    const closedDecision = createCarBodyContactHooks(closed, () => undefined).decideHullContact(
      body,
      getHullQuery('shootme')
    )
    const openedDecision = createCarBodyContactHooks(opened, () => undefined).decideHullContact(
      body,
      getHullQuery('shootme')
    )

    // Assert
    expect(closedDecision.isAccepted).toBe(true)
    expect(openedDecision.isAccepted).toBe(false)
  })

  it('lets a projectile through only once the barrier is open (0x0041f730)', () => {
    // Arrange
    const closed = createSurfaces()
    const opened = getSurfacesWithBarrierOpen(closed, 'shootme', true)

    // Act
    const closedSurface = getProbeSurface(closed, 'shootme')
    const openedSurface = getProbeSurface(opened, 'shootme')

    // Assert
    expect(closedSurface.isPassThrough).toBe(false)
    expect(openedSurface).toEqual({ isPassThrough: true, signalIdentifier: BARRIER_SIGNAL })
  })
})
