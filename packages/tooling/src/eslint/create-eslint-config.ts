import javascript from '@eslint/js'
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import typescript from 'typescript-eslint'
import { ABBREVIATED_IDENTIFIERS } from './abbreviated-identifiers.ts'
import type { EslintConfigOptions } from './create-eslint-config.types.ts'

const TEST_BLOCKS = 'describe|it|test|beforeEach|afterEach|beforeAll|afterAll'
const ARROW_FUNCTION_MESSAGE = 'Use an arrow function: `const name = () => …`.'
const CLASS_MESSAGE =
  'Use a factory function that returns a frozen object. A class is only for extending something: `class X extends Error`, or a library base class.'

export const createEslintConfig = (options: EslintConfigOptions): Linter.Config[] =>
  defineConfig(
    {
      ignores: [
        'dist/**',
        'build/**',
        'coverage/**',
        'node_modules/**',
        ...(options.ignores ?? []),
      ],
    },
    javascript.configs.recommended,
    typescript.configs.strictTypeChecked,
    eslintComments.recommended,
    {
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      languageOptions: {
        globals: options.environment === 'browser' ? globals.browser : globals.node,
        parserOptions: {
          projectService: { allowDefaultProject: ['*.js', '*.mjs'] },
          tsconfigRootDir: options.rootDirectory,
        },
      },
      rules: {
        '@eslint-community/eslint-comments/require-description': 'error',
        '@eslint-community/eslint-comments/disable-enable-pair': [
          'error',
          { allowWholeFile: true },
        ],
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-confusing-void-expression': [
          'error',
          { ignoreArrowShorthand: true },
        ],
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/prefer-readonly': 'error',
        'arrow-body-style': ['error', 'as-needed'],
        'no-param-reassign': ['error', { props: true }],
        'no-restricted-syntax': [
          'error',
          { selector: 'FunctionDeclaration', message: ARROW_FUNCTION_MESSAGE },
          // Methods and constructors are FunctionExpressions in the AST; inside an allowed class they're fine.
          {
            selector: 'FunctionExpression:not(MethodDefinition > FunctionExpression)',
            message: ARROW_FUNCTION_MESSAGE,
          },
          {
            // `{ return x }` is arrow-body-style's; this catches the block around one call. Test
            // blocks (`describe('…', () => { it(…) })`) and assignments keep their braces.
            selector: `ArrowFunctionExpression:not(CallExpression[callee.name=/^(${TEST_BLOCKS})$/] > ArrowFunctionExpression) > BlockStatement[body.length=1] > ExpressionStatement[expression.type!='AssignmentExpression']`,
            message: 'A one-expression body omits its braces: `() => doThing()`.',
          },
          { selector: 'ClassDeclaration:not([superClass])', message: CLASS_MESSAGE },
          { selector: 'ClassExpression:not([superClass])', message: CLASS_MESSAGE },
          { selector: 'TSEnumDeclaration', message: 'Use createEnum instead of `enum`.' },
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'process',
            property: 'env',
            message:
              'Read configuration through the environment module — never process.env directly.',
          },
        ],
        '@typescript-eslint/naming-convention': [
          'error',
          // Object literal keys often mirror external APIs (`{ env }`, `{ src }`), so only declared names are checked.
          { selector: ['objectLiteralProperty', 'objectLiteralMethod'], format: null },
          // Destructured names come from someone else's shape (a schema, an API), not the author.
          { selector: 'variable', modifiers: ['destructured'], format: null },
          { selector: 'parameter', modifiers: ['destructured'], format: null },
          // Listed with types too: a rule naming a type outranks one that only names a modifier.
          { selector: 'parameter', modifiers: ['destructured'], types: ['boolean'], format: null },
          { selector: 'variable', modifiers: ['destructured'], types: ['boolean'], format: null },
          {
            selector: 'default',
            format: null,
            custom: { regex: `^(${ABBREVIATED_IDENTIFIERS.join('|')})$`, match: false },
          },
          {
            selector: ['variable', 'parameter', 'typeProperty', 'classProperty', 'accessor'],
            types: ['boolean'],
            format: ['PascalCase'],
            prefix: ['is'],
          },
        ],
      },
    },
    {
      files: [
        ...(options.environmentReaderFiles ?? ['src/shared/environment/**']),
        '*.config.*',
        'scripts/**',
        '**/*.spec.*',
        '**/*.test.*',
      ],
      rules: { 'no-restricted-properties': 'off' },
    },
    {
      files: ['**/*.spec.*', '**/*.test.*'],
      rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
    },
    { files: ['**/*.{js,mjs,cjs}'], extends: [typescript.configs.disableTypeChecked] },
    prettier
  )
