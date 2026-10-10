import { statSync } from 'node:fs'
import { join } from 'node:path'
import {
  listProjectFiles,
  readOptionalProjectFile,
  readProjectFile,
} from '../../project/project-files.ts'
import { ProjectKind } from '../../project/workspace/workspace.types.ts'
import { CheckId, type Check, type CheckContext, type Violation } from '../check.types.ts'
import type { PackageWiring, ProjectWiring, WorkspacePackageWiring } from './gate-wiring.types.ts'
import type { PackageManifest } from '../../project/package-manifest.types.ts'

const PRE_PUSH_HOOK = 'pre-push'
export const PRE_PUSH_HOOK_PATH = `.git-hooks/${PRE_PUSH_HOOK}`
const CI_GATE = /\bpnpm run ci\b/
const CI_SECRET_SCAN = /\bgitleaks detect\b/
const GATE_SCRIPTS = ['typecheck', 'lint', 'verify', 'test', 'build', 'format:check', 'audit:high']
const SCRIPT_REFERENCE = /\b(?:pnpm|npm|yarn)(?:\s+run)?\s+([\w:-]+)/g
const PACKAGE_MANAGER_COMMANDS = new Set(['exec', 'install', 'add', 'audit', 'dlx', 'update', 'i'])

export const getRequiredGateScripts = (): readonly string[] => GATE_SCRIPTS

const collectReachableScripts = (
  scripts: Readonly<Record<string, string>>,
  name: string,
  visited: ReadonlySet<string>
): ReadonlySet<string> => {
  const command = scripts[name]
  if (command === undefined || visited.has(name)) return visited
  const referenced = [...command.matchAll(SCRIPT_REFERENCE)]
    .map(([, script = '']) => script)
    .filter((script) => !PACKAGE_MANAGER_COMMANDS.has(script))
  return referenced.reduce<ReadonlySet<string>>(
    (reached, script) => collectReachableScripts(scripts, script, reached),
    new Set([...visited, name])
  )
}

/** Whether a command runs `script` in every workspace package (`pnpm -r run ci`). */
export const getIsRecursiveRun = (command: string, script: string): boolean =>
  command
    .split(/&&|\|\||;/)
    .some(
      (part) =>
        /\bpnpm\b/.test(part) &&
        /\s(?:-r|--recursive)\b/.test(part) &&
        new RegExp(`\\s(?:run\\s+)?${script}\\s*$`).test(part)
    )

const getVerifyScriptProblems = (scripts: Readonly<Record<string, string>>): readonly Violation[] =>
  // The tooling package runs its own CLI by path: pnpm links a package's bin only into others.
  /\b(?:tooling|src\/cli\/main\.ts) verify\b/.test(scripts['verify'] ?? '')
    ? []
    : [
        {
          path: 'package.json',
          line: null,
          message: 'the "verify" script must run `tooling verify`',
        },
      ]

const getGateProblems = (scripts: Readonly<Record<string, string>>): readonly Violation[] => {
  const problems: Violation[] = []
  const reachable = collectReachableScripts(scripts, 'ci', new Set())
  const unreached = getRequiredGateScripts().filter((script) => !reachable.has(script))
  if (unreached.length > 0) {
    problems.push({
      path: 'package.json',
      line: null,
      message: `the "ci" script never runs: ${unreached.join(', ')}`,
    })
  }
  problems.push(...getVerifyScriptProblems(scripts))
  return problems
}

const getAgentBriefProblems = (claudeDocument: string | null): readonly Violation[] =>
  (claudeDocument ?? '').includes('@AGENTS.md')
    ? []
    : [{ path: 'CLAUDE.md', line: null, message: 'must import the agent brief with `@AGENTS.md`' }]

const getRepositoryHookProblems = (wiring: ProjectWiring): readonly Violation[] => {
  const problems: Violation[] = []
  if (!(wiring.scripts['prepare'] ?? '').includes('core.hooksPath .git-hooks')) {
    problems.push({
      path: 'package.json',
      line: null,
      message: 'the "prepare" script must run `git config core.hooksPath .git-hooks`',
    })
  }
  if (!(wiring.prePushHook ?? '').includes(`tooling hook ${PRE_PUSH_HOOK}`)) {
    problems.push({
      path: PRE_PUSH_HOOK_PATH,
      line: null,
      message: `must run \`tooling hook ${PRE_PUSH_HOOK}\``,
    })
  } else if (!wiring.isPrePushHookExecutable) {
    problems.push({
      path: PRE_PUSH_HOOK_PATH,
      line: null,
      message:
        'is not executable, so git silently skips it (chmod +x and `git update-index --chmod=+x`)',
    })
  }
  for (const hook of ['post-edit', 'stop']) {
    if (!(wiring.claudeSettings ?? '').includes(`tooling hook ${hook}`)) {
      problems.push({
        path: '.claude/settings.json',
        line: null,
        message: `must run \`tooling hook ${hook}\``,
      })
    }
  }
  const isGateRunInCi = wiring.workflows.some(
    (workflow) => CI_GATE.test(workflow) && CI_SECRET_SCAN.test(workflow)
  )
  if (!isGateRunInCi) {
    problems.push({
      path: '.github/workflows',
      line: null,
      message: 'no workflow runs both `pnpm run ci` and `gitleaks detect`',
    })
  }
  return problems
}

/** A single-repository project: gate, hooks, CI and agent brief all at its root. */
export const findWiringProblems = (wiring: ProjectWiring): readonly Violation[] => [
  ...getGateProblems(wiring.scripts),
  ...getRepositoryHookProblems(wiring),
  ...getAgentBriefProblems(wiring.claudeDocument),
]

/** A workspace package: its own gate and agent brief; hooks and CI belong to the workspace root. */
export const findPackageWiringProblems = (wiring: PackageWiring): readonly Violation[] => [
  ...getGateProblems(wiring.scripts),
  ...getAgentBriefProblems(wiring.claudeDocument),
]

const getRootScriptProblems = (scripts: Readonly<Record<string, string>>): readonly Violation[] =>
  ['check', 'ci'].flatMap((script) => {
    const reached = [...collectReachableScripts(scripts, script, new Set())]
    const isVerified = reached.includes('verify')
    const isRecursive = reached.some((name) => getIsRecursiveRun(scripts[name] ?? '', script))
    if (isVerified && isRecursive) return []
    const missing = [
      ...(isVerified ? [] : ['`pnpm run verify`']),
      ...(isRecursive ? [] : [`\`pnpm -r run ${script}\``]),
    ]
    return [
      {
        path: 'package.json',
        line: null,
        message: `the "${script}" script never runs ${missing.join(' or ')}`,
      },
    ]
  })

const getMissingPackagesProblems = (
  packages: readonly WorkspacePackageWiring[]
): readonly Violation[] =>
  packages.length === 0
    ? [{ path: 'pnpm-workspace.yaml', line: null, message: 'lists no folder with a package.json' }]
    : []

/** A workspace root: repository hooks, CI and brief, a gate that runs every package's, and wired packages. */
export const findWorkspaceWiringProblems = (
  wiring: ProjectWiring,
  packages: readonly WorkspacePackageWiring[]
): readonly Violation[] => [
  ...getMissingPackagesProblems(packages),
  ...getRootScriptProblems(wiring.scripts),
  ...getVerifyScriptProblems(wiring.scripts),
  ...getRepositoryHookProblems(wiring),
  ...getAgentBriefProblems(wiring.claudeDocument),
  ...packages.flatMap((workspacePackage) =>
    findPackageWiringProblems(workspacePackage.wiring).map((problem) => ({
      ...problem,
      path: `${workspacePackage.path}/${problem.path}`,
    }))
  ),
]

const getIsExecutable = (path: string): boolean => {
  try {
    return (statSync(path).mode & 0o111) !== 0
  } catch {
    return false
  }
}

const readPackageWiring = (root: string): PackageWiring => {
  const manifest = JSON.parse(readProjectFile(root, 'package.json')) as PackageManifest
  return {
    scripts: manifest.scripts ?? {},
    claudeDocument: readOptionalProjectFile(root, 'CLAUDE.md'),
  }
}

const readWiring = (root: string): ProjectWiring => ({
  ...readPackageWiring(root),
  prePushHook: readOptionalProjectFile(root, PRE_PUSH_HOOK_PATH),
  isPrePushHookExecutable: getIsExecutable(join(root, PRE_PUSH_HOOK_PATH)),
  claudeSettings: readOptionalProjectFile(root, '.claude/settings.json'),
  workflows: listProjectFiles(root, '.github/workflows')
    .filter((path) => /\.ya?ml$/.test(path))
    .map((path) => readProjectFile(root, path)),
})

const getWiringProblems = (context: CheckContext): readonly Violation[] => {
  if (context.kind === ProjectKind.WORKSPACE_PACKAGE)
    return findPackageWiringProblems(readPackageWiring(context.root))
  if (context.kind === ProjectKind.WORKSPACE_ROOT) {
    return findWorkspaceWiringProblems(
      readWiring(context.root),
      context.workspacePackages.map((workspacePackage) => ({
        path: workspacePackage.path,
        wiring: readPackageWiring(join(context.root, workspacePackage.path)),
      }))
    )
  }
  return findWiringProblems(readWiring(context.root))
}

export const gateWiringCheck: Check = {
  id: CheckId.GATE_WIRING,
  description:
    'The gate is still plugged in: gate scripts, CI workflow, git and Claude Code hooks, agent brief.',
  fix: 'Restore the wiring (copy it from another package in this workspace). Never remove a gate step to get green.',
  run: (context: CheckContext) => Promise.resolve(getWiringProblems(context)),
}
