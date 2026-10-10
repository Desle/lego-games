import { getIsWorkspaceFolder, parseWorkspacePatterns } from './workspace.ts'

describe('parseWorkspacePatterns', () => {
  it('reads the packages list with quotes, comments and exclusions', () => {
    // Arrange
    const content = `allowBuilds:
  esbuild: true
packages:
  # services
  - 'nas/*'
  - "packages/**"
  - ./tools/cli/ # the CLI
  - '!packages/fixtures'
catalog:
  zod: ^4.0.0
`

    // Act
    const patterns = parseWorkspacePatterns(content)

    // Assert
    expect(patterns).toEqual({
      included: ['nas/*', 'packages/**', 'tools/cli'],
      excluded: ['packages/fixtures'],
    })
  })

  it('treats a file without packages as a single project', () => {
    // Arrange
    const content = 'allowBuilds:\n  esbuild: true\n'

    // Act
    const patterns = parseWorkspacePatterns(content)

    // Assert
    expect(patterns).toBeNull()
  })
})

describe('getIsWorkspaceFolder', () => {
  it('matches one level for * and any depth for **, minus exclusions', () => {
    // Arrange
    const patterns = { included: ['nas/*', 'packages/**'], excluded: ['packages/old'] }

    // Act
    const matches = [
      'nas/gateway',
      'nas/gateway/src',
      'packages/a/b',
      'packages/old',
      'desktop',
    ].map((folder) => getIsWorkspaceFolder(patterns, folder))

    // Assert
    expect(matches).toEqual([true, false, true, false, false])
  })
})
