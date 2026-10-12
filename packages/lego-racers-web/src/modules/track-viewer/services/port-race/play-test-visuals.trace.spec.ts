import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runRenderComparison } from './render-comparison.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

// The textures of the bricks' trails (putraily: ptrailP, ptrailS, ptrailT, ptrailM).
const TRAIL_TEXTURE_PATTERN = /^pup(red|blue|gree|yell)2$/

// Three things the original draws that the port drew wrongly (docs/reverse-engineering/play-test-visuals.md). Each case
// failed before its fix: the numbers in the comments are the render trace's findings on main.
describe.skipIf(!isGamePresent())('play-test visuals', () => {
  it('draws the alien ship’s beam only while its event runs (53 event 3, 0x00463700)', async () => {
    // Arrange: the introduction fly-by looks at the ship; the event has not begun, so the original draws no beam
    const request = {
      name: 'Alien Rally Asteroid, beam',
      raceFolder: 'RACEC2R3',
      recordFrames: [5, 50, 100, 130],
      watched: [{ label: 'beam', originalTexture: 'arabeam', portSource: '^beamdumy' }],
    }

    // Act
    const result = await runRenderComparison(request)

    // Assert: before the fix the port drew 16 triangles of beamdumy in each of these frames
    expect(
      result.watched.map((count) => [count.frame, count.originalCount, count.portCount])
    ).toEqual([5, 50, 100, 130].map((frame) => [frame, 0, 0]))
  })

  it('draws the trail around every power-up brick (0x00453b90 through 0x0045a8a0)', async () => {
    // Arrange
    const request = {
      name: 'Alien Rally Asteroid, brick trails',
      raceFolder: 'RACEC2R3',
      recordFrames: [5, 100, 170, 250],
    }

    // Act
    const result = await runRenderComparison(request)

    // Assert: before the fix the original's trail triangles (pupred2, pupblue2, pupyell2) had no partner at all
    const missing = result.groups.filter(
      (group) => group.kind === 'missing_in_port' && TRAIL_TEXTURE_PATTERN.test(group.source)
    )
    expect(missing.map((group) => `${group.source} x${String(group.count)}`)).toEqual([])
  })

  it('stops drawing the shortcut barrels once they break (0x0048ef70)', async () => {
    // Arrange: the closed-loop drive fires a cannon ball at the barrier at frame 1460; the original opens it at 1477
    const request = {
      name: 'Pirate shortcut barrels',
      raceFolder: 'RACEC0R1',
      isRouteDriven: true,
      recordFrames: [1470, 1478, 1490, 1550],
      powerUp: { kind: 1, level: 0, grantFrame: 1457, useFrame: 1460, frameCount: 1560 },
      watched: [{ label: 'barrels', originalTexture: '^barrel2$', portSource: '^(block|barrel)' }],
    }

    // Act
    const result = await runRenderComparison(request)

    // Assert: before the fix the port drew the 98 triangles of the four parts in every one of these frames
    const [before, ...after] = result.watched
    expect(before?.originalCount).toBeGreaterThan(0)
    expect(before?.portCount).toBeGreaterThan(0)
    expect(after.map((count) => [count.frame, count.originalCount, count.portCount])).toEqual(
      [1478, 1490, 1550].map((frame) => [frame, 0, 0])
    )
  })
})
