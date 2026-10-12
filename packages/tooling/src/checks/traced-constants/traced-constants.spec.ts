import { findConstantLiterals } from './find-constant-literals.ts'
import { createBaseline, findBaselineProblems } from './traced-constants-baseline.ts'

const PATH = 'packages/lego-racers/src/modules/racer/controller/drag.ts'

const getLiterals = (...lines: readonly string[]) =>
  findConstantLiterals(PATH, lines.join('\n')).map((found) => found.literal)

describe('findConstantLiterals', () => {
  it('flags an unnamed number and a named constant without an address', () => {
    // Arrange
    const lines = ['const DRAG = 0.05', 'const getSpeed = (speed: number) => speed * 0.95']

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['0.05', '0.95'])
  })

  it('accepts a named constant with an address on the same line or the comment line above', () => {
    // Arrange
    const lines = [
      'const DRAG = 0.05 // float32 0.05 at 0x004b07f0',
      '// float32 0.5 at 0x10001234',
      'export const HALF_LIFE = 0.5',
      'const TABLE = Object.freeze([',
      '  3, // 0x004b0001',
      '  4,',
      '])',
    ]

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['4'])
  })

  it('does not let a neighbouring statement or a string lend its address', () => {
    // Arrange
    const lines = [
      'const FIRST = 0.05 // 0x004b07f0',
      'const SECOND = 0.06',
      'const THIRD = "0x004b07f0"; const FOURTH = 7',
      'const getDrag = () => 0.07 // 0x004b07f0',
    ]

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['0.06', '7', '0.07'])
  })

  it('does not let a named constant cover a number inside a function it declares', () => {
    // Arrange
    const lines = ['const update = () => speed * 0.05 // 0x004b07f0']

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['0.05'])
  })

  it('allows structural values, byte masks, byte shifts, indices and types', () => {
    // Arrange
    const lines = [
      'const half = (value: number) => value / 2 + 1 - 0 + -1',
      'const low = (value: number) => value & 0xff',
      'const high = (value: number) => (value >>> 24) & 0xffff_ffff',
      'const third = (values: readonly number[]) => values[3]',
      'type Version = 7 | -3',
      'const shift = (value: number) => value << 3',
      'const decimalMask = (value: number) => value & 255',
    ]

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['3', '255'])
  })

  it('keeps a negative number as one constant', () => {
    // Arrange
    const lines = ['const getBias = () => -0.25']

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['-0.25'])
  })

  it('accepts a reasoned @check-allow on the line or the statement', () => {
    // Arrange
    const lines = [
      'const A = 5 // @check-allow traced-constants: buffer size of our own',
      '// @check-allow traced-constants: layout of our own file',
      'const B = {',
      '  size: 6,',
      '}',
      'const C = 7 // @check-allow traced-constants:',
    ]

    // Act
    const literals = getLiterals(...lines)

    // Assert
    expect(literals).toEqual(['7'])
  })

  it('records the enclosing names so the key survives line shifts', () => {
    // Arrange
    const content = 'export const getDrag = () => {\n  const table = { slow: 9 }\n  return table\n}'

    // Act
    const found = findConstantLiterals(PATH, content)

    // Assert
    expect(found.map((literal) => literal.scope)).toEqual(['getDrag.table.slow'])
  })
})

describe('findBaselineProblems', () => {
  const OLD = { path: PATH, line: 1, scope: 'DRAG', literal: '0.05' }

  it('passes literals the baseline lists, wherever they moved to', () => {
    // Arrange
    const baseline = createBaseline([OLD])

    // Act
    const problems = findBaselineProblems([{ ...OLD, line: 40 }], baseline)

    // Assert
    expect(problems).toEqual([])
  })

  it('fails a new literal, a changed number and an extra copy', () => {
    // Arrange
    const baseline = createBaseline([OLD])

    // Act
    const problems = findBaselineProblems(
      [
        { ...OLD, literal: '0.06' },
        { ...OLD, line: 2 },
        { ...OLD, line: 3 },
      ],
      baseline
    )

    // Assert
    expect(problems.map((problem) => problem.line)).toEqual([1, 2, 3])
  })

  it('fails baseline slack so it can never hide a new literal', () => {
    // Arrange
    const baseline = createBaseline([OLD, { ...OLD, line: 2 }])

    // Act
    const problems = findBaselineProblems([OLD], baseline)

    // Assert
    expect(problems).toHaveLength(1)
    expect(problems[0]?.message).toContain('pnpm run traced-constants:baseline')
  })
})
