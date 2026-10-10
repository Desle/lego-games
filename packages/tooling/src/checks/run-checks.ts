import type { ResolvedToolingConfig } from '../config/tooling-config.types.ts'
import { getHasExtension, listProjectFiles, readProjectFile } from '../project/project-files.ts'
import { loadTypescriptProject } from '../project/typescript-project.ts'
import { getProjectKind, listWorkspacePackages } from '../project/workspace/workspace.ts'
import { getChecks } from './check-registry.ts'
import type { CheckContext } from './check.types.ts'
import type { CheckOutcome } from './run-checks.types.ts'

export const createCheckContext = (root: string, config: ResolvedToolingConfig): CheckContext => {
  const allSourceDirectoryFiles = listProjectFiles(root, config.sourceDirectory)
  return {
    root,
    config,
    kind: getProjectKind(root),
    workspacePackages: listWorkspacePackages(root) ?? [],
    allSourceDirectoryFiles,
    sourceFiles: new Map(
      allSourceDirectoryFiles
        .filter((path) => getHasExtension(path, config.sourceExtensions))
        .map((path) => [path, readProjectFile(root, path)])
    ),
    typescriptProject: loadTypescriptProject(root, config),
  }
}

export const runChecks = async (context: CheckContext): Promise<readonly CheckOutcome[]> =>
  Promise.all(
    getChecks(context.kind).map(async (check) => {
      try {
        return { check, violations: await check.run(context) }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          check,
          violations: [{ path: '.', line: null, message: `the check crashed: ${message}` }],
        }
      }
    })
  )

export const formatReport = (outcomes: readonly CheckOutcome[]): string => {
  const failed = outcomes.filter((outcome) => outcome.violations.length > 0)
  const lines = outcomes.flatMap((outcome) => {
    if (outcome.violations.length === 0) return [`✓ ${outcome.check.id}`]
    return [
      `✗ ${outcome.check.id} — ${outcome.check.description}`,
      ...outcome.violations.map(
        (violation) =>
          `    ${violation.path}${violation.line === null ? '' : `:${String(violation.line)}`}  ${violation.message}`
      ),
      `    Fix: ${outcome.check.fix}`,
    ]
  })
  const summary =
    failed.length === 0
      ? `tooling verify: all ${String(outcomes.length)} checks passed`
      : `tooling verify: ${String(failed.length)} of ${String(outcomes.length)} checks failed`
  return [...lines, '', summary].join('\n')
}
