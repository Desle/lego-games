import { createFidelityReport, createMarkdownTable, mergeResults } from './fidelity-report.ts'
import { FidelityItemKind } from './ldraw-fidelity.types.ts'
import type { FidelityResult } from './ldraw-fidelity.types.ts'

const getResult = (id: string, score: number): FidelityResult => ({
  id,
  kind: FidelityItemKind.BRICK,
  name: id,
  score,
  isPassed: score >= 80,
  views: [],
  meanIntersectionOverUnion: 0.9,
  minimumIntersectionOverUnion: 0.8,
  centroidOffset: [0, 0, 0],
  boundsCentreOffset: [0, 0, 0],
  sizeRatio: [1, 1, 1],
  scaleRatio: 1,
  meanColorDifference: null,
  anchors: [],
  meanAnchorDistance: null,
  footprintCoverage: null,
  note: '',
})

describe('createMarkdownTable', () => {
  it('pads every column to its widest cell, as Prettier does', () => {
    // Arrange
    const headers = ['A', 'Long header']
    const rows = [['wide cell', 'x|y']]
    // Act
    const table = createMarkdownTable(headers, rows)
    // Assert
    expect(table).toBe(
      [
        '| A         | Long header |',
        '| --------- | ----------- |',
        '| wide cell | x\\|y        |',
      ].join('\n')
    )
  })
})

describe('mergeResults', () => {
  it('replaces the items of a new run, keeps the others and sorts worst first', () => {
    // Arrange
    const previous = [getResult('a', 90), getResult('b', 40)]
    const fresh = [getResult('b', 95), getResult('c', 10)]
    // Act
    const merged = mergeResults(previous, fresh)
    // Assert
    expect(merged.map((result) => [result.id, result.score])).toEqual([
      ['c', 10],
      ['a', 90],
      ['b', 95],
    ])
  })
})

describe('createFidelityReport', () => {
  it('counts the passes by kind and lists the worst first', () => {
    // Arrange
    const results = [getResult('good', 95), getResult('bad', 20)]
    // Act
    const report = createFidelityReport(results)
    // Assert
    expect(report).toContain('1 of 2 items pass')
    expect(report).toContain('| brick | 2     | 1      | 57.5       | bad (20.0) |')
    expect(report.indexOf('`bad`')).toBeLessThan(report.indexOf('`good`'))
  })
})
