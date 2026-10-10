import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { loadConfig } from '../config/load-config.ts'

const getPushedBranches = (input: string): readonly string[] =>
  input
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[2] ?? '')
    .filter((remoteReference) => remoteReference.startsWith('refs/heads/'))
    .map((remoteReference) => remoteReference.slice('refs/heads/'.length))

/** git pre-push: block protected branches, then run the full gate and the secret scan. */
export const runPrePushHook = async (root: string): Promise<number> => {
  const config = await loadConfig(root)
  const protectedPushes = getPushedBranches(readFileSync(0, 'utf8')).filter((branch) =>
    config.protectedBranches.includes(branch)
  )
  if (protectedPushes.length > 0) {
    process.stderr.write(
      `[tooling] Pushing to ${protectedPushes.join(', ')} is blocked. Push a branch and open a pull request.\n`
    )
    return 1
  }
  const gate = spawnSync(config.ciCommand, { cwd: root, shell: true, stdio: 'inherit' })
  if (gate.status !== 0) return 1
  const gitleaks = spawnSync('gitleaks', ['detect', '--source', '.', '--no-banner', '--redact'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (gitleaks.error !== undefined) {
    process.stderr.write('[tooling] gitleaks is not installed; the secret scan runs in CI only.\n')
    return 0
  }
  return gitleaks.status === 0 ? 0 : 1
}
