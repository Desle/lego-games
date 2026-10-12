import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const TOOLING_ROOT = resolve(import.meta.dirname, '../..')
const WORKSPACE_FIXTURE = join(TOOLING_ROOT, 'tests/fixtures/sample-workspace')
const CLI = join(TOOLING_ROOT, 'src/cli/main.ts')
// Node and the system tools (git), but not a gitleaks installed through a package manager.
const TEST_PATH = [dirname(process.execPath), '/usr/bin', '/bin'].join(':')

const replacePlaceholders = (directory: string) => {
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name)
    if (!statSync(path).isFile()) continue
    const content = readFileSync(path, 'utf8')
    if (content.includes('__TOOLING__'))
      writeFileSync(path, content.replaceAll('__TOOLING__', TOOLING_ROOT))
  }
}

const createWorkspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'tooling-'))
  cpSync(WORKSPACE_FIXTURE, root, { recursive: true })
  replacePlaceholders(root)
  chmodSync(join(root, '.git-hooks/pre-push'), 0o755)
  return root
}

const runCli = (root: string, parameters: readonly string[], input = '') =>
  spawnSync('node', [CLI, ...parameters], {
    cwd: root,
    encoding: 'utf8',
    input,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, PATH: TEST_PATH },
  })

const setGateCommands = (root: string, commands: Readonly<Record<string, string>>) =>
  writeFileSync(join(root, 'tooling.config.ts'), `export default ${JSON.stringify(commands)}\n`)

const updatePackageScripts = (path: string, scripts: Readonly<Record<string, string>>) => {
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as { scripts: Record<string, string> }
  writeFileSync(path, JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, ...scripts } }))
}

describe('tooling verify', () => {
  let root = ''

  beforeEach(() => {
    root = createWorkspace()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('passes at the root and inside each package', () => {
    // Arrange
    const packageRoot = join(root, 'packages/notes')

    // Act
    const rootResult = runCli(root, ['verify'])
    const packageResult = runCli(packageRoot, ['verify'])

    // Assert
    expect(rootResult.stdout).toContain('all 3 checks passed')
    expect(packageResult.stdout).toContain('all 6 checks passed')
  })

  it('fails at the root when a package leaves the gate', () => {
    // Arrange
    updatePackageScripts(join(root, 'packages/notes/package.json'), { verify: 'true' })

    // Act
    const result = runCli(root, ['verify'])

    // Assert
    expect(result.status).toBe(1)
    expect(result.stdout).toContain(
      'packages/notes/package.json  the "verify" script must run `tooling verify`'
    )
  })

  it('fails on a file no tool reads and on a layer break, with a Fix line', () => {
    // Arrange
    const packageRoot = join(root, 'packages/notes')
    writeFileSync(join(packageRoot, 'src/Card.vue'), '<template><div /></template>\n')
    writeFileSync(
      join(packageRoot, 'src/modules/notes/types/note-reader.ts'),
      "import { readFile } from 'node:fs'\nexport const reader = readFile\n"
    )

    // Act
    const result = runCli(packageRoot, ['verify'])

    // Assert
    expect(result.status).toBe(1)
    expect(result.stdout).toContain(
      'src/Card.vue  not read by the architecture checks, TypeScript, ESLint'
    )
    expect(result.stdout).toContain(
      "the types layer must stay framework-free, but imports 'node:fs'"
    )
    expect(result.stdout).toContain('Fix: ')
  })
})

describe('tooling hook pre-push', () => {
  let root = ''

  beforeEach(() => {
    root = createWorkspace()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('blocks a push to main without running the gate', () => {
    // Arrange
    setGateCommands(root, { ciCommand: 'echo gate-ran' })
    const push = 'refs/heads/feature 1111 refs/heads/main 2222\n'

    // Act
    const result = runCli(root, ['hook', 'pre-push'], push)

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Pushing to main is blocked')
    expect(result.stdout).not.toContain('gate-ran')
  })

  it('blocks a branch push when the gate fails', () => {
    // Arrange
    setGateCommands(root, { ciCommand: 'exit 1' })

    // Act
    const result = runCli(root, ['hook', 'pre-push'], 'refs/heads/a 1 refs/heads/a 2\n')

    // Assert
    expect(result.status).toBe(1)
  })

  it('lets a branch push through a green gate, and says when gitleaks is missing', () => {
    // Arrange
    setGateCommands(root, { ciCommand: 'exit 0' })

    // Act
    const result = runCli(root, ['hook', 'pre-push'], 'refs/heads/a 1 refs/heads/a 2\n')

    // Assert
    expect(result.status).toBe(0)
    expect(result.stderr).toContain('gitleaks is not installed')
  })
})

describe('tooling hook stop', () => {
  let root = ''

  beforeEach(() => {
    root = createWorkspace()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('keeps Claude working while the check is red, and shows why', () => {
    // Arrange
    setGateCommands(root, { checkCommand: 'echo typecheck failed && exit 1' })

    // Act
    const result = runCli(root, ['hook', 'stop'], '{}')

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('The work is not done yet')
    expect(result.stderr).toContain('typecheck failed')
  })

  it('lets Claude stop when the check is green', () => {
    // Arrange
    setGateCommands(root, { checkCommand: 'exit 0' })

    // Act
    const result = runCli(root, ['hook', 'stop'], '{}')

    // Assert
    expect(result.status).toBe(0)
  })

  it('never blocks twice in a row, so Claude cannot loop on it', () => {
    // Arrange
    setGateCommands(root, { checkCommand: 'exit 1' })

    // Act
    const result = runCli(root, ['hook', 'stop'], '{"stop_hook_active":true}')

    // Assert
    expect(result.status).toBe(0)
  })
})

describe('tooling hook post-edit', () => {
  let root = ''

  beforeEach(() => {
    root = createWorkspace()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('formats the edited file', () => {
    // Arrange
    const path = join(root, 'packages/notes/src/main.ts')
    writeFileSync(
      path,
      'import type { NoteId } from "./modules/notes/index.ts";\n\nexport const firstNote = "first" as NoteId;\n'
    )

    // Act
    const result = runCli(
      root,
      ['hook', 'post-edit'],
      JSON.stringify({ tool_input: { file_path: path } })
    )

    // Assert
    expect(result.status).toBe(0)
    expect(readFileSync(path, 'utf8')).toBe(
      "import type { NoteId } from './modules/notes/index.ts'\n\nexport const firstNote = 'first' as NoteId\n"
    )
  }, 60_000)

  it('feeds lint errors that auto-fix cannot repair back to Claude', () => {
    // Arrange
    const path = join(root, 'packages/notes/src/main.ts')
    writeFileSync(path, 'export const value: any = 1\n')

    // Act
    const result = runCli(
      root,
      ['hook', 'post-edit'],
      JSON.stringify({ tool_input: { file_path: path } })
    )

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('no-explicit-any')
  }, 60_000)

  it('ignores files outside the project', () => {
    // Arrange
    const input = JSON.stringify({ tool_input: { file_path: '/etc/hosts' } })

    // Act
    const result = runCli(root, ['hook', 'post-edit'], input)

    // Assert
    expect(result.status).toBe(0)
  })
})
