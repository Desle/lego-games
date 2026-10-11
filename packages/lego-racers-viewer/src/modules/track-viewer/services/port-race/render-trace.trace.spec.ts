import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runRenderComparison } from './render-comparison.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

describe.skipIf(!isGamePresent())('render trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `describe(...)`, not `describe.skipIf(...)(...)`
  it('compares Royal Knights', async () => {
    // Arrange
    const request = {
      name: 'Royal Knights',
      raceFolder: 'RACEC0R0',
      isSteering: true,
      recordFrames: [5, 60, 150, 170, 200, 250, 300, 350, 400, 450],
    }

    // Act
    const result = await runRenderComparison(request)

    // Assert
    console.log(
      result.totals.map((total) => JSON.stringify(total)).join('\n'),
      '\n',
      result.groups
        .map((group) => `${group.kind} ${group.source} x${String(group.count)} in ${String(group.frames.length)} frames: ${group.firstDetail}`)
        .join('\n')
    )
    expect(result.totals.length).toBeGreaterThan(0)
  })
})
