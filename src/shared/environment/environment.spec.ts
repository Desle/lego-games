import { getEnvironment } from './environment.ts'
import { EnvironmentName } from './environment.types.ts'

describe('getEnvironment', () => {
  it('defaults to development', () => {
    // Arrange
    const source = {}

    // Act
    const environment = getEnvironment(source)

    // Assert
    expect(environment.name).toBe(EnvironmentName.DEVELOPMENT)
  })

  it('reads a known NODE_ENV', () => {
    // Arrange
    const source = { NODE_ENV: 'production' }

    // Act
    const environment = getEnvironment(source)

    // Assert
    expect(environment.name).toBe(EnvironmentName.PRODUCTION)
  })

  it('rejects an unknown NODE_ENV at startup', () => {
    // Arrange
    const source = { NODE_ENV: 'staging' }

    // Act
    const readEnvironment = () => getEnvironment(source)

    // Assert
    expect(readEnvironment).toThrow(/NODE_ENV must be one of development, test, production/)
  })

  it('returns a frozen object', () => {
    // Arrange
    const source = {}

    // Act
    const environment = getEnvironment(source)

    // Assert
    expect(Object.isFrozen(environment)).toBe(true)
  })
})
