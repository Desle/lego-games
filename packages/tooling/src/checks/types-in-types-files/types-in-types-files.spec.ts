import { findInlineTypeDeclarations } from './types-in-types-files.ts'

describe('findInlineTypeDeclarations', () => {
  it('catches interfaces, generic aliases and nested declarations', () => {
    // Arrange
    const content = [
      'interface User { id: string }',
      'export type Pair<Value> = [Value, Value]',
      'const build = () => { type Local = number; return 1 as Local }',
      'type Allowed = string // @check-allow types-in-types-files: demonstrating the escape hatch',
      'const url = "http://example.com" // type Ignored = string',
    ].join('\n')

    // Act
    const violations = findInlineTypeDeclarations('src/user.ts', content)

    // Assert
    expect(violations.map((violation) => violation.line)).toEqual([1, 2, 3])
  })

  it('ignores types files and tests', () => {
    // Arrange
    const content = 'export type User = { id: string }'

    // Act
    const typesFileViolations = findInlineTypeDeclarations('src/user.types.ts', content)
    const specViolations = findInlineTypeDeclarations('src/user.spec.ts', content)

    // Assert
    expect([...typesFileViolations, ...specViolations]).toEqual([])
  })

  it('reads the script block of a single-file component with correct line numbers', () => {
    // Arrange
    const content = [
      '<template>',
      '  <div />',
      '</template>',
      '<script setup lang="ts">',
      'interface Props { label: string }',
      '</script>',
    ].join('\n')

    // Act
    const violations = findInlineTypeDeclarations('src/Card.vue', content)

    // Assert
    expect(violations.map((violation) => violation.line)).toEqual([5])
  })

  it('catches inline object types in parameters, casts and return types, once each', () => {
    // Arrange
    const content = [
      'export const load = (options: { readonly path: string }) => options.path',
      'export const parse = (raw: string) => JSON.parse(raw) as { nested: { deep: number } }',
      'export const make = (): { id: string } => ({ id: "1" })',
      'export const keep = (values: Record<string, number>) => values',
    ].join('\n')

    // Act
    const violations = findInlineTypeDeclarations('src/load.ts', content)

    // Assert
    expect(violations.map((violation) => violation.line)).toEqual([1, 2, 3])
  })
})
