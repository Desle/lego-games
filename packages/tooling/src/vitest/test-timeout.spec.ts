import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getNodeTestOptions, getTestTimeout } from './test-timeout.ts'

describe('getTestTimeout', () => {
  it('keeps the default without the original files and allows long runs with them', () => {
    // Arrange
    const withoutFiles = mkdtempSync(join(tmpdir(), 'timeout-'))
    const withFiles = mkdtempSync(join(tmpdir(), 'timeout-'))
    mkdirSync(join(withFiles, 'original-files'))

    // Act
    const timeouts = [getTestTimeout(withoutFiles), getTestTimeout(withFiles)]

    // Assert
    expect(timeouts).toEqual([5_000, 60_000])
  })
})

describe('getNodeTestOptions', () => {
  it('runs the specs with globals in Node under the repository timeout', () => {
    // Arrange
    const repositoryRoot = mkdtempSync(join(tmpdir(), 'options-'))

    // Act
    const options = getNodeTestOptions(repositoryRoot)

    // Assert
    expect(options).toEqual({
      globals: true,
      environment: 'node',
      include: ['src/**/*.spec.ts'],
      testTimeout: 5_000,
    })
  })
})
