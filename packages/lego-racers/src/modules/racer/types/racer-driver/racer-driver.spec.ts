import {
  createTestCarBody,
  createTestCarBodyWith,
  IDENTITY_TABLES,
  SINGLE_ARITHMETIC,
} from '../racer-fixtures/racer-fixtures.ts'
import {
  applyDriverSteering,
  applyDriverThrottle,
  createRacerDriver,
  setDriverSteering,
  setDriverThrottle,
  startDriverPowerSlide,
  stopDriverPowerSlide,
  updateDriverWithoutRoute,
  updateRacerDriver,
} from './racer-driver.ts'

describe('setDriverSteering', () => {
  it('turns full steering into 1 / (0.00025 + 0.02475) = 40 (0x0041fe60)', () => {
    // Arrange
    const driver = createRacerDriver()

    // Act
    const result = setDriverSteering(SINGLE_ARITHMETIC, driver, createTestCarBody(), 1)

    // Assert
    expect(result.curvature).toBe(40)
  })

  it('negates the steering while wobbling (flag 0x10) and gives 0 for no steering', () => {
    // Arrange
    const driver = { ...createRacerDriver(), flags: 0x10 }

    // Act
    const wobbling = setDriverSteering(SINGLE_ARITHMETIC, driver, createTestCarBody(), 1)
    const straight = setDriverSteering(SINGLE_ARITHMETIC, driver, createTestCarBody(), 0)

    // Assert
    expect(wobbling.curvature).toBe(-40)
    expect(straight.curvature).toBe(0)
  })
})

describe('setDriverThrottle', () => {
  it.each([
    [1, 1, 54],
    [-1, 1, -108],
    [-1, 0, -54],
    [0.5, -1, 54],
    [0.5, 0, 27],
  ])(
    'throttle %f at forward speed %d gives %d (doubled when braking, 0x00420130)',
    (throttle, speed, force) => {
      // Arrange
      const body = createTestCarBodyWith({ forwardSpeed: speed })

      // Act
      const result = setDriverThrottle(SINGLE_ARITHMETIC, createRacerDriver(), body, throttle)

      // Assert
      expect(result.throttle).toBe(force)
    }
  )

  it('adds the wobble and clamps to [-1, 1] while flag 0x10 is set', () => {
    // Arrange
    const driver = { ...createRacerDriver(), flags: 0x10, wobbleThrottle: 0.75 }

    // Act
    const result = setDriverThrottle(SINGLE_ARITHMETIC, driver, createTestCarBody(), 0.5)

    // Assert
    expect(result.throttle).toBe(54)
  })
})

describe('applyDriverSteering', () => {
  it('straightens and ends the slide when both curvatures are zero', () => {
    // Arrange
    const driven = {
      driver: createRacerDriver(),
      carBody: createTestCarBodyWith({ turnRadius: 50, flags: 0x1 }),
    }

    // Act
    const result = applyDriverSteering(SINGLE_ARITHMETIC, IDENTITY_TABLES, driven)

    // Assert
    expect(result.carBody.rigidBody.turnRadius).toBe(0)
    expect(result.carBody.rigidBody.flags).toBe(0)
  })

  it('scales the curvature by 0.2 below speed 0.04 and keeps it under the limit', () => {
    // Arrange: maximum curvature without grip on the ground is 4096.
    const driven = {
      driver: { ...createRacerDriver(), curvature: 500 },
      carBody: createTestCarBodyWith({ groundedWheelCount: 4 }),
    }

    // Act
    const result = applyDriverSteering(SINGLE_ARITHMETIC, IDENTITY_TABLES, driven)

    // Assert: (4096 + 100) · 0.5.
    expect(result.driver.curvature).toBe(2098)
    expect(result.carBody.rigidBody.turnRadius).toBe(2098)
  })
})

describe('applyDriverThrottle', () => {
  it('drives at 54 · 8 with flag 0x1 and half that while touching (0x100)', () => {
    // Arrange
    const driver = { ...createRacerDriver(), flags: 0x1 }
    const carBody = createTestCarBody()

    // Act
    const full = applyDriverThrottle(SINGLE_ARITHMETIC, { driver, carBody })
    const touching = applyDriverThrottle(SINGLE_ARITHMETIC, {
      driver: { ...driver, flags: 0x101 },
      carBody,
    })

    // Assert
    expect(full.carBody.rigidBody.throttle).toBe(432)
    expect(touching.carBody.rigidBody.throttle).toBe(216)
  })

  it('multiplies a positive throttle by 8 during a slide boost (flag 0x8)', () => {
    // Arrange
    const driver = { ...createRacerDriver(), flags: 0x8, throttle: 54 }

    // Act
    const result = applyDriverThrottle(SINGLE_ARITHMETIC, { driver, carBody: createTestCarBody() })

    // Assert
    expect(result.driver.throttle).toBe(432)
    expect(result.carBody.rigidBody.throttle).toBe(432)
  })
})

describe('startDriverPowerSlide and stopDriverPowerSlide', () => {
  it('starts with factor 0.4 when braking and stops back to 0.2', () => {
    // Arrange
    const carBody = createTestCarBodyWith({
      velocityDirection: { x: 1, y: 0, z: 0 },
      groundedWheelCount: 4,
      forwardSpeed: 1,
    })

    // Act
    const started = startDriverPowerSlide(
      SINGLE_ARITHMETIC,
      { driver: createRacerDriver(), carBody },
      1
    )
    const stopped = stopDriverPowerSlide(started)

    // Assert
    expect(started.driver).toMatchObject({ flags: 0x4, slideDirection: 1 })
    expect(started.carBody.rigidBody).toMatchObject({ flags: 0x400, leanFactor: Math.fround(0.4) })
    expect(stopped.driver.flags).toBe(0)
    expect(stopped.carBody.rigidBody).toMatchObject({ flags: 0, leanFactor: Math.fround(0.2) })
  })
})

describe('updateRacerDriver', () => {
  it('draws three random values for the wobble when it is due (0x0041fc00)', () => {
    // Arrange
    const update = {
      driver: { ...createRacerDriver(), flags: 0x10 },
      carBody: createTestCarBody(),
      randomPosition: 0,
    }

    // Act
    const result = updateRacerDriver(SINGLE_ARITHMETIC, IDENTITY_TABLES, update, 16)

    // Assert: values 1, 2 and 3; 2 · 0.01 - 2 and 3 · 0.01 - 1 in float32.
    expect(result.randomPosition).toBe(3)
    expect(result.driver).toMatchObject({
      wobbleMilliseconds: 1,
      wobbleSteering: Math.fround(Math.fround(2 * Math.fround(0.01)) - 2),
      wobbleThrottle: Math.fround(Math.fround(3 * Math.fround(0.01)) - 1),
    })
  })

  it('counts the wobble down when it is not due', () => {
    // Arrange
    const update = {
      driver: { ...createRacerDriver(), flags: 0x10, wobbleMilliseconds: 40 },
      carBody: createTestCarBody(),
      randomPosition: 0,
    }

    // Act
    const result = updateRacerDriver(SINGLE_ARITHMETIC, IDENTITY_TABLES, update, 16)

    // Assert
    expect(result.randomPosition).toBe(0)
    expect(result.driver.wobbleMilliseconds).toBe(24)
  })

  it('ends a slide boost after 300 ms and copies the curvature to the previous one', () => {
    // Arrange
    const update = {
      driver: { ...createRacerDriver(), flags: 0x8, slideMilliseconds: 290, curvature: 0 },
      carBody: createTestCarBody(),
      randomPosition: 0,
    }

    // Act
    const result = updateRacerDriver(SINGLE_ARITHMETIC, IDENTITY_TABLES, update, 16)

    // Assert
    expect(result.driver).toMatchObject({ flags: 0, slideMilliseconds: 0, previousCurvature: 0 })
  })
})

describe('updateDriverWithoutRoute', () => {
  it('brakes with -108 while moving forward (0x0041fd60)', () => {
    // Arrange
    const driven = {
      driver: createRacerDriver(),
      carBody: createTestCarBodyWith({ forwardSpeed: 1 }),
    }

    // Act
    const result = updateDriverWithoutRoute(SINGLE_ARITHMETIC, IDENTITY_TABLES, driven)

    // Assert
    expect(result.driver.throttle).toBe(-108)
    expect(result.carBody.rigidBody.throttle).toBe(-108)
  })
})
