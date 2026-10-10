export type CoverageInput = {
  readonly paths: readonly string[]
  readonly scannedExtensions: readonly string[]
  readonly nonSourceExtensions: readonly string[]
  readonly typecheckedPaths: ReadonlySet<string>
  readonly lintedPaths: ReadonlySet<string>
}
