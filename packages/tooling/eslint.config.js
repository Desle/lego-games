import { createEslintConfig } from './src/eslint/create-eslint-config.ts'

export default createEslintConfig({
  rootDirectory: import.meta.dirname,
  environmentReaderFiles: ['src/project/project-root.ts'],
  ignores: ['tests/fixtures/**'],
})
