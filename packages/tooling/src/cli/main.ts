#!/usr/bin/env node
import { loadConfig } from '../config/load-config.ts'
import { createCheckContext, formatReport, runChecks } from '../checks/run-checks.ts'
import { runPostEditHook } from '../hooks/post-edit-hook.ts'
import { runPrePushHook } from '../hooks/pre-push-hook.ts'
import { runStopHook } from '../hooks/stop-hook.ts'
import { getProjectRoot } from '../project/project-root.ts'

const USAGE = `tooling <command>

  verify                          run every architecture check (part of \`pnpm run check\`)
  hook <post-edit|stop|pre-push>  entry points for Claude Code and git hooks`

const verify = async (root: string): Promise<number> => {
  const outcomes = await runChecks(createCheckContext(root, await loadConfig(root)))
  console.log(formatReport(outcomes))
  return outcomes.some((outcome) => outcome.violations.length > 0) ? 1 : 0
}

const runHook = (root: string, hook: string | undefined): Promise<number> => {
  if (hook === 'post-edit') return runPostEditHook(root)
  if (hook === 'stop') return runStopHook(root)
  if (hook === 'pre-push') return runPrePushHook(root)
  console.error(`unknown hook '${hook ?? ''}'\n\n${USAGE}`)
  return Promise.resolve(1)
}

const run = (parameters: readonly string[]): Promise<number> => {
  const [command, ...rest] = parameters
  // verify acts on the folder it runs in (pnpm runs a package's scripts inside it); hooks act
  // on the repository Claude Code opened, wherever its shell has wandered.
  switch (command) {
    case 'verify':
      return verify(process.cwd())
    case 'hook':
      return runHook(getProjectRoot(), rest[0])
    default:
      console.log(USAGE)
      return Promise.resolve(command === undefined || command === '--help' ? 0 : 1)
  }
}

process.exitCode = await run(process.argv.slice(2))
