import { createEnum, type EnumValues } from '../../shared/types/enum.types.ts'

export const ProjectKind = createEnum({
  SINGLE: 'single',
  WORKSPACE_ROOT: 'workspace_root',
  WORKSPACE_PACKAGE: 'workspace_package',
})
export type ProjectKind = EnumValues<typeof ProjectKind>

export type WorkspacePatterns = {
  readonly included: readonly string[]
  readonly excluded: readonly string[]
}

export type WorkspacePackage = {
  /** Folder relative to the workspace root, e.g. `nas/gateway`. */
  readonly path: string
  readonly name: string
  readonly description: string
}
