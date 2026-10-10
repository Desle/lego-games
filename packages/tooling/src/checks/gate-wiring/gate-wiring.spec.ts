import {
  findPackageWiringProblems,
  findWiringProblems,
  findWorkspaceWiringProblems,
  getIsRecursiveRun,
} from './gate-wiring.ts'

const WIRED = {
  scripts: {
    typecheck: 'tsc --noEmit',
    lint: 'eslint .',
    verify: 'tooling verify',
    test: 'vitest run',
    check: 'pnpm run typecheck && pnpm run lint && pnpm run verify && pnpm run test',
    'format:check': 'prettier --check .',
    build: 'tsc -p tsconfig.build.json',
    'audit:high': 'pnpm audit --audit-level high',
    ci: 'pnpm run check && pnpm run format:check && pnpm build && pnpm run audit:high',
    prepare: 'git config core.hooksPath .git-hooks',
  },
  prePushHook: '#!/bin/sh\nexec node_modules/.bin/tooling hook pre-push',
  isPrePushHookExecutable: true,
  claudeSettings: '{"hooks": "tooling hook post-edit tooling hook stop"}',
  workflows: [
    'jobs:\n  gate:\n    steps:\n      - run: pnpm run ci\n      - run: gitleaks detect --source .',
  ],
  claudeDocument: '@AGENTS.md',
}

describe('findWiringProblems', () => {
  it('accepts a fully wired project, following nested script references', () => {
    // Arrange
    const wiring = WIRED

    // Act
    const problems = findWiringProblems(wiring)

    // Assert
    expect(problems).toEqual([])
  })

  it('flags a gate step removed from ci and every unplugged hook', () => {
    // Arrange
    const wiring = {
      ...WIRED,
      scripts: { ...WIRED.scripts, check: 'pnpm run typecheck && pnpm run test' },
      isPrePushHookExecutable: false,
      claudeSettings: '{}',
      workflows: [],
      claudeDocument: 'See AGENTS.md',
    }

    // Act
    const problems = findWiringProblems(wiring)

    // Assert
    expect(problems.map((problem) => `${problem.path}: ${problem.message}`)).toEqual([
      'package.json: the "ci" script never runs: lint, verify',
      '.git-hooks/pre-push: is not executable, so git silently skips it (chmod +x and `git update-index --chmod=+x`)',
      '.claude/settings.json: must run `tooling hook post-edit`',
      '.claude/settings.json: must run `tooling hook stop`',
      '.github/workflows: no workflow runs both `pnpm run ci` and `gitleaks detect`',
      'CLAUDE.md: must import the agent brief with `@AGENTS.md`',
    ])
  })
})

const WIRED_PACKAGE = {
  scripts: Object.fromEntries(Object.entries(WIRED.scripts).filter(([name]) => name !== 'prepare')),
  claudeDocument: '@AGENTS.md',
}

const WIRED_WORKSPACE = {
  ...WIRED,
  scripts: {
    verify: 'tooling verify',
    check: 'pnpm run verify && pnpm -r run check',
    ci: 'pnpm run verify && pnpm --recursive run ci && pnpm run format:check',
    'format:check': 'prettier --check .',
    prepare: 'git config core.hooksPath .git-hooks',
  },
}

describe('findPackageWiringProblems', () => {
  it('needs only the gate and the brief: hooks and CI belong to the workspace root', () => {
    // Arrange
    const wiring = WIRED_PACKAGE

    // Act
    const problems = findPackageWiringProblems(wiring)

    // Assert
    expect(problems).toEqual([])
  })
})

describe('findWorkspaceWiringProblems', () => {
  it('accepts a root whose gate runs every package gate, with wired packages', () => {
    // Arrange
    const packages = [{ path: 'nas/gateway', wiring: WIRED_PACKAGE }]

    // Act
    const problems = findWorkspaceWiringProblems(WIRED_WORKSPACE, packages)

    // Assert
    expect(problems).toEqual([])
  })

  it('flags a root gate that skips the packages and a package without verify', () => {
    // Arrange
    const wiring = {
      ...WIRED_WORKSPACE,
      scripts: { ...WIRED_WORKSPACE.scripts, ci: 'pnpm run verify' },
    }
    const packages = [
      {
        path: 'nas/gateway',
        wiring: { ...WIRED_PACKAGE, scripts: { ...WIRED_PACKAGE.scripts, verify: 'true' } },
      },
    ]

    // Act
    const problems = findWorkspaceWiringProblems(wiring, packages)

    // Assert
    expect(problems.map((problem) => `${problem.path}: ${problem.message}`)).toEqual([
      'package.json: the "ci" script never runs `pnpm -r run ci`',
      'nas/gateway/package.json: the "verify" script must run `tooling verify`',
    ])
  })

  it('flags a workspace without packages', () => {
    // Arrange
    const packages: readonly [] = []

    // Act
    const problems = findWorkspaceWiringProblems(WIRED_WORKSPACE, packages)

    // Assert
    expect(problems[0]?.path).toBe('pnpm-workspace.yaml')
  })
})

describe('getIsRecursiveRun', () => {
  it('recognises -r and --recursive with or without run, and nothing else', () => {
    // Arrange
    const commands = [
      'pnpm -r run ci',
      'pnpm run verify && pnpm --recursive ci',
      'pnpm run ci',
      'pnpm -r run check',
    ]

    // Act
    const results = commands.map((command) => getIsRecursiveRun(command, 'ci'))

    // Assert
    expect(results).toEqual([true, true, false, false])
  })
})
