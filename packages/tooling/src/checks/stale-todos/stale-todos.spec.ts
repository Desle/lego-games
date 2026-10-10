import { getTodoAges } from './stale-todos.ts'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

describe('getTodoAges', () => {
  it('dates each TODO by its own line, not by the file', () => {
    // Arrange
    const now = Date.UTC(2026, 9, 4)
    const blame = [
      'abc 1 1 1',
      `author-time ${String((now - 365 * MILLISECONDS_PER_DAY) / 1000)}`,
      '\t// TODO old work',
      'def 2 2 1',
      `author-time ${String((now - MILLISECONDS_PER_DAY) / 1000)}`,
      '\tconst value = 1',
      'def 3 3 1',
      `author-time ${String((now - MILLISECONDS_PER_DAY) / 1000)}`,
      '\t// FIXME new work',
    ].join('\n')

    // Act
    const ages = getTodoAges(blame, now)

    // Assert
    expect(ages).toEqual([
      { line: 1, ageInDays: 365 },
      { line: 3, ageInDays: 1 },
    ])
  })
})
