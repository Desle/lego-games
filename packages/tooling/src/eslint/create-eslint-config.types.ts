export type EslintConfigOptions = {
  /** Pass import.meta.dirname from eslint.config.js. */
  readonly rootDirectory: string
  readonly environment?: 'node' | 'browser'
  /** The only files allowed to read process.env. */
  readonly environmentReaderFiles?: readonly string[]
  readonly ignores?: readonly string[]
}
