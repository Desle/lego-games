import { getTrackedSymlinkPaths } from './tracked-symlinks.ts'

describe('getTrackedSymlinkPaths', () => {
  it('lists only the entries with the symlink mode', () => {
    // Arrange
    const stagedFiles = [
      '100644 0a1b2c 0\tpackage.json',
      '120000 3d4e5f 0\toriginal-files',
      '100755 6a7b8c 0\t.git-hooks/pre-push',
    ].join('\n')

    // Act
    const paths = getTrackedSymlinkPaths(stagedFiles)

    // Assert
    expect(paths).toEqual(['original-files'])
  })
})
