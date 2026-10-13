export type ToolingConfig = {
  /** Root of the code the checks govern. */
  readonly sourceDirectory?: string
  /** Extensions the architecture checks parse. Add '.tsx', '.vue', … when the stack needs them. */
  readonly sourceExtensions?: readonly string[]
  /** Extra non-code extensions allowed under the source directory (assets, data). */
  readonly nonSourceExtensions?: readonly string[]
  /** Extensions TypeScript tooling reads besides .ts/.tsx, e.g. '.vue' for vue-tsc. */
  readonly typecheckedExtraExtensions?: readonly string[]
  readonly tsconfigPath?: string
  /** Top-level folders under the source directory that any code may import, e.g. 'components' for shadcn/ui. */
  readonly sharedDirectories?: readonly string[]
  /** For each layer folder inside a module: the other layers it may import. */
  readonly layers?: Readonly<Record<string, readonly string[]>>
  /** Layers that must not import any package (pure domain code). */
  readonly frameworkFreeLayers?: readonly string[]
  /** Packages no file of this package may import: a package name or the start of one, e.g. '@lego-games/lego-racers'. */
  readonly forbiddenImports?: readonly string[]
  readonly maximumTodoAgeInDays?: number
  readonly specsDirectory?: string
  readonly requiredSpecSections?: readonly string[]
  readonly protectedBranches?: readonly string[]
  /** Fast gate the Claude Code stop hook runs. */
  readonly checkCommand?: string
  /** Full gate the pre-push hook runs. */
  readonly ciCommand?: string
}

export type ResolvedToolingConfig = {
  readonly [Key in keyof ToolingConfig]-?: Exclude<ToolingConfig[Key], undefined>
}

/** What importing tooling.config.ts yields. */
export type ToolingConfigModule = {
  readonly default?: ToolingConfig
}
