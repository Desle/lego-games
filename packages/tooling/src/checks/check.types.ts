import type { ResolvedToolingConfig } from '../config/tooling-config.types.ts'
import type { TypescriptProject } from '../project/typescript-project.types.ts'
import type { ProjectKind, WorkspacePackage } from '../project/workspace/workspace.types.ts'
import { createEnum, type EnumValues } from '../shared/types/enum.types.ts'

export const CheckId = createEnum({
  SOURCE_COVERAGE: 'source-coverage',
  TYPES_IN_TYPES_FILES: 'types-in-types-files',
  LAYER_BOUNDARIES: 'layer-boundaries',
  STALE_TODOS: 'stale-todos',
  FEATURE_SPECS: 'feature-specs',
  GATE_WIRING: 'gate-wiring',
  TRACKED_SYMLINKS: 'tracked-symlinks',
})
export type CheckId = EnumValues<typeof CheckId>

export type Violation = {
  readonly path: string
  readonly line: number | null
  readonly message: string
}

export type CheckContext = {
  readonly root: string
  readonly config: ResolvedToolingConfig
  readonly kind: ProjectKind
  /** The packages under a workspace root; empty for any other kind. */
  readonly workspacePackages: readonly WorkspacePackage[]
  /** Every file under the source directory, scanned or not. */
  readonly allSourceDirectoryFiles: readonly string[]
  /** Contents of the files the checks parse (matching sourceExtensions). */
  readonly sourceFiles: ReadonlyMap<string, string>
  readonly typescriptProject: TypescriptProject
}

export type Check = {
  readonly id: CheckId
  readonly description: string
  readonly fix: string
  readonly run: (context: CheckContext) => Promise<readonly Violation[]>
}
