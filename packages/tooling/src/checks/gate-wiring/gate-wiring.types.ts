/** What a package owns: its gate scripts and its agent brief. */
export type PackageWiring = {
  readonly scripts: Readonly<Record<string, string>>
  readonly claudeDocument: string | null
}

/** What a repository owns besides that: git and Claude Code hooks, CI. */
export type ProjectWiring = PackageWiring & {
  readonly prePushHook: string | null
  readonly isPrePushHookExecutable: boolean
  readonly claudeSettings: string | null
  readonly workflows: readonly string[]
}

export type WorkspacePackageWiring = {
  readonly path: string
  readonly wiring: PackageWiring
}
