import { ESLint } from 'eslint'
import { createEslintConfig } from './create-eslint-config.ts'

const BRACES_MESSAGE = 'A one-expression body omits its braces'

const getBraceProblems = async (code: string, filePath = 'src/index.ts') => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({ rootDirectory: process.cwd() }),
  })
  const [result] = await eslint.lintText(code, { filePath })
  const fatal = result?.messages.find((message) => message.fatal === true)
  if (fatal !== undefined) throw new Error(`could not lint the sample: ${fatal.message}`)
  return (result?.messages ?? [])
    .filter(
      (message) =>
        message.ruleId === 'arrow-body-style' || message.message.startsWith(BRACES_MESSAGE)
    )
    .map((message) => message.line)
}

describe('arrow function bodies', () => {
  it('flags a block around one expression or one return, and allows the short form', async () => {
    // Arrange
    const code = [
      'export const log = (write: () => void) => {',
      '  write()',
      '}',
      'export const double = (value: number) => {',
      '  return value * 2',
      '}',
      'export const logShort = (write: () => void) => write()',
      'export const doubleShort = (value: number) => value * 2',
      '',
    ].join('\n')

    // Act
    const lines = await getBraceProblems(code)

    // Assert
    expect(lines).toEqual([2, 4])
  })

  it('keeps braces for assignments and test blocks', async () => {
    // Arrange
    const code = [
      'let count = 0',
      'export const reset = () => {',
      '  count = 0',
      '}',
      "describe('reset', () => {",
      "  it('runs', () => reset())",
      '})',
      'export const read = () => count',
      '',
    ].join('\n')

    // Act
    const lines = await getBraceProblems(code, 'src/cli/main.spec.ts')

    // Assert
    expect(lines).toEqual([])
  })
})

const getFunctionFormProblems = async (code: string) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({ rootDirectory: process.cwd() }),
  })
  const [result] = await eslint.lintText(code, { filePath: 'src/index.ts' })
  const fatal = result?.messages.find((message) => message.fatal === true)
  if (fatal !== undefined) throw new Error(`could not lint the sample: ${fatal.message}`)
  return (result?.messages ?? [])
    .filter(
      (message) =>
        message.message.startsWith('Use an arrow function') ||
        message.message.startsWith('Use a factory function')
    )
    .map((message) => message.line)
}

describe('function and class forms', () => {
  it('allows classes that extend something, with methods and constructors', async () => {
    // Arrange
    const code = [
      'export class NotFoundError extends Error {',
      '  readonly status = 404',
      '  constructor(message: string) {',
      '    super(message)',
      "    this.name = 'NotFoundError'",
      '  }',
      '  getLabel(): string {',
      '    return `${this.name}: ${this.message}`',
      '  }',
      '}',
      '',
    ].join('\n')

    // Act
    const lines = await getFunctionFormProblems(code)

    // Assert
    expect(lines).toEqual([])
  })

  it('flags standalone classes, function declarations, expressions and object methods', async () => {
    // Arrange
    const code = [
      'export class Counter {',
      '  readonly start = 0',
      '}',
      'export const Anonymous = class {}',
      'export function add(value: number) {',
      '  return value + 1',
      '}',
      'export const subtract = function (value: number) {',
      '  return value - 1',
      '}',
      'export const helpers = {',
      '  double(value: number) {',
      '    return value * 2',
      '  },',
      '}',
      '',
    ].join('\n')

    // Act
    const lines = await getFunctionFormProblems(code)

    // Assert
    expect(lines).toEqual([1, 4, 5, 8, 12])
  })
})

const getRuleProblems = async (code: string, ruleIds: readonly string[]) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({ rootDirectory: process.cwd() }),
  })
  const [result] = await eslint.lintText(code, { filePath: 'src/index.ts' })
  const fatal = result?.messages.find((message) => message.fatal === true)
  if (fatal !== undefined) throw new Error(`could not lint the sample: ${fatal.message}`)
  return (result?.messages ?? [])
    .filter((message) => ruleIds.includes(message.ruleId ?? ''))
    .map((message) => `${String(message.line)} ${message.ruleId ?? ''}`)
}

describe('names taken from someone else', () => {
  it('lets destructured parameters keep their names, but not declared ones', async () => {
    // Arrange
    const code = [
      'export const describeMonitoring = ({ monitored }: Readonly<Record<string, boolean>>) =>',
      "  monitored === true ? 'on' : 'off'",
      "export const describeFlag = (monitored: boolean) => (monitored ? 'on' : 'off')",
      'export const settings: Readonly<Record<string, boolean>> = { monitored: true }',
      'const { monitored } = settings',
      "export const status = monitored === true ? 'on' : 'off'",
      '',
    ].join('\n')

    // Act
    const problems = await getRuleProblems(code, ['@typescript-eslint/naming-convention'])

    // Assert
    expect(problems).toEqual(['3 @typescript-eslint/naming-convention'])
  })

  it('accepts a whole-file disable with a reason and no closing enable', async () => {
    // Arrange
    const code = [
      '/* eslint-disable @typescript-eslint/naming-convention -- field names mirror the Sonarr API */',
      'export type SonarrSeries = { readonly monitored: boolean }',
      '',
    ].join('\n')

    // Act
    const problems = await getRuleProblems(code, [
      '@typescript-eslint/naming-convention',
      '@eslint-community/eslint-comments/disable-enable-pair',
    ])

    // Assert
    expect(problems).toEqual([])
  })
})
