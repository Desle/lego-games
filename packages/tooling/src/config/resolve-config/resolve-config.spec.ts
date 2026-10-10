import { DEFAULT_CONFIG, resolveConfig } from './resolve-config.ts'

describe('resolveConfig', () => {
  it('fills every option from the defaults', () => {
    // Arrange
    const config = {}

    // Act
    const resolved = resolveConfig(config)

    // Assert
    expect(resolved).toEqual(DEFAULT_CONFIG)
  })

  it('lets explicit options win and keeps the other defaults', () => {
    // Arrange
    const config = { sourceExtensions: ['.ts', '.tsx'] }

    // Act
    const resolved = resolveConfig(config)

    // Assert
    expect(resolved.sourceExtensions).toEqual(['.ts', '.tsx'])
    expect(resolved.specsDirectory).toBe('.docs/specs')
  })
})
