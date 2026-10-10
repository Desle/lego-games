/** The fields of a package.json the tooling reads. */
export type PackageManifest = {
  readonly name?: string
  readonly version?: string
  readonly description?: string
  readonly scripts?: Readonly<Record<string, string>>
}
