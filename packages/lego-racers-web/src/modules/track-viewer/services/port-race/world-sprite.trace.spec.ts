import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runRenderComparison } from './render-comparison.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

type WorldSpriteCase = {
  readonly request: TraceScenarioRequest
  // The port objects of the sprites (`/` and the material) and the names the matcher gives their textures.
  readonly sources: readonly string[]
  readonly textureNames: readonly string[]
}

// The demonstration lap (the computer drives, the camera follows) passes the sprites: trees that turn around their axis,
// and a planet and a plane that face the camera whole. Every triangle of theirs the original draws must have a partner
// at its place, with its texture coordinates and its colour; only the state differs (the viewer's alpha test stands in
// for the colour key, render-trace.md finding 9).
const WORLD_SPRITE_CASES: readonly WorldSpriteCase[] = [
  {
    request: {
      name: 'Royal Knights, tree sprites',
      raceFolder: 'RACEC0R0',
      localPlayerCount: 0,
      frameCount: 345,
      recordFrames: [250, 340],
    },
    sources: ['/rktree'],
    textureNames: ['rndtree'],
  },
  {
    request: {
      name: 'Royal Knights, mirrored tree sprites',
      raceFolder: 'RACEC0R0',
      isMirrored: true,
      localPlayerCount: 0,
      frameCount: 345,
      recordFrames: [250, 340],
    },
    sources: ['/rktree'],
    textureNames: ['rndtree'],
  },
  {
    request: {
      name: 'RACEC0R3, camera-facing sprites',
      raceFolder: 'RACEC0R3',
      localPlayerCount: 0,
      frameCount: 525,
      recordFrames: [340, 520],
    },
    sources: ['/mmplanet', '/mmplane2'],
    textureNames: ['mmplanet', 'mmplane2'],
  },
]

describe.skipIf(!isGamePresent())('world sprites trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)`, not `it.each(...)(...)`
  it.each(WORLD_SPRITE_CASES)(
    'draws what the original draws: $request.name',
    async (spriteCase) => {
      // Arrange / Act
      const result = await runRenderComparison(spriteCase.request)

      // Assert
      const differences = result.groups.filter(
        (group) =>
          (spriteCase.sources.includes(group.source) && group.kind !== 'state') ||
          (spriteCase.textureNames.includes(group.source) && group.kind === 'missing_in_port')
      )
      expect(
        differences.map((group) => `${group.kind} ${group.source} ${group.firstDetail}`)
      ).toEqual([])
      expect(
        result.groups.some(
          (group) => spriteCase.sources.includes(group.source) && group.kind === 'state'
        )
      ).toBe(true)
    }
  )
})
