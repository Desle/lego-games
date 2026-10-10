import { findCoverageGaps } from './source-coverage.ts'

describe('findCoverageGaps', () => {
  it('names every tool that skips a file', () => {
    // Arrange
    const input = {
      paths: ['src/a.ts', 'src/Card.vue', 'src/Button.tsx', 'src/card.css'],
      scannedExtensions: ['.ts'],
      nonSourceExtensions: ['.css'],
      typecheckedPaths: new Set(['src/a.ts', 'src/Button.tsx']),
      lintedPaths: new Set(['src/a.ts']),
    }

    // Act
    const gaps = findCoverageGaps(input)

    // Assert
    expect(gaps.map((gap) => `${gap.path}: ${gap.message}`)).toEqual([
      'src/Card.vue: not read by the architecture checks, TypeScript, ESLint — its rules are NOT enforced',
      'src/Button.tsx: not read by the architecture checks, ESLint — its rules are NOT enforced',
    ])
  })

  it('passes a file every tool reads', () => {
    // Arrange
    const input = {
      paths: ['src/a.ts'],
      scannedExtensions: ['.ts'],
      nonSourceExtensions: [],
      typecheckedPaths: new Set(['src/a.ts']),
      lintedPaths: new Set(['src/a.ts']),
    }

    // Act
    const gaps = findCoverageGaps(input)

    // Assert
    expect(gaps).toEqual([])
  })
})
