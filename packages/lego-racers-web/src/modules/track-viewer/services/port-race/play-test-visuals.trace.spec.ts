import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { BARRIER_REQUEST } from './play-test-visual-cases.ts'
import { runRenderComparison } from './render-comparison.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

// The textures of the bricks' trails (putraily: ptrailP, ptrailS, ptrailT, ptrailM; enhaner: p2trailw).
const TRAIL_TEXTURE_PATTERN = /^pup(red|blue|gree|yell|whit)2$/
const TRAIL_OBJECT_PATTERN = /^(PUTRAILY|ENHANER)\//
// The frames just after the barrier opens, while the barrels' clip plays (19 frames) and the camera still sees them.
const BREAKING_FRAMES = [1478, 1480]
// What the barrier case leaves unmatched in every frame whatever the barrels do: two skid triangles and two of a picture
// the matcher cannot name (render-trace.md).
const KNOWN_UNMATCHED_PER_FRAME = 4

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
    const wrong = result.groups.filter(
      (group) =>
        (group.kind === 'missing_in_port' && TRAIL_TEXTURE_PATTERN.test(group.source)) ||
        (group.kind === 'extra_in_port' && TRAIL_OBJECT_PATTERN.test(group.source))
    )
    expect(wrong.map((group) => `${group.kind} ${group.source} x${String(group.count)}`)).toEqual(
      []
    )
  })

  it('draws the shortcut barrels breaking, fading with their clip, as the original does (0x0048f080)', async () => {
    // Arrange: the closed-loop drive fires a cannon ball at the barrier at frame 1460; the original opens it at 1477
    const request = BARRIER_REQUEST

    // Act
    const result = await runRenderComparison(request)

    // Assert: the gate draws its four parts while their clip plays. Hiding them as the barrier opens (the world's own
    // distances are 0) left the original's 98 triangles of them without a partner on 1478 and 1480 (missing_in_port);
    // the original's triangles are counted by geometry, as most of the barrels' pictures have no name the matcher knows.
    const breaking = result.watched.filter((count) => BREAKING_FRAMES.includes(count.frame))
    const unmatched = result.totals
      .filter((total) => BREAKING_FRAMES.includes(total.frame))
      .map((total) => total.originalCount - total.matchedCount)
    const extraBarrels = result.groups.filter(
      (group) => group.kind === 'extra_in_port' && /^(block|barrel)/i.test(group.source)
    )
    expect(breaking.map((count) => count.portCount > 0)).toEqual([true, true])
    expect(Math.max(...unmatched)).toBeLessThanOrEqual(KNOWN_UNMATCHED_PER_FRAME)
    expect(extraBarrels).toEqual([])
  })

  it('turns the power-up bricks with their clip, as the original does (0x00457900, 0x0045a490)', async () => {
    // Arrange: frames 12 apart (396 ms, half a turn of the 800 ms clip) with bricks in view
    const request = {
      name: 'Alien Rally Asteroid, brick spin',
      raceFolder: 'RACEC2R3',
      recordFrames: [250, 262],
      watched: [{ label: 'bricks', originalTexture: '^pup', portSource: '^PUBRICKY/' }],
    }

    // Act
    const result = await runRenderComparison(request)

    // Assert: the port's brick triangles moved between the frames and every one has a partner in the original at both
    const [first, second] = result.watched
    const distance = Math.hypot(
      (first?.portCentre[0] ?? 0) - (second?.portCentre[0] ?? 0),
      (first?.portCentre[1] ?? 0) - (second?.portCentre[1] ?? 0),
      (first?.portCentre[2] ?? 0) - (second?.portCentre[2] ?? 0)
    )
    const mismatches = result.groups.filter(
      (group) => /^PUBRICKY\//.test(group.source) && group.kind !== 'state'
    )
    expect(first?.portCount).toBeGreaterThan(0)
    expect(distance).toBeGreaterThan(0.01)
    expect(mismatches.map((group) => `${group.kind} ${group.source}`)).toEqual([])
  })
})
