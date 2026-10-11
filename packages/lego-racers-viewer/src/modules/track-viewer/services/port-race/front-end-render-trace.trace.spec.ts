import { createRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndDrawCommand,
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndResources,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  compareQuadPlacements,
  getIsOriginalPresentationAvailable,
  getOriginalQuads,
  matchTextures,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import type {
  OriginalRenderFrame,
  PortTexture,
  QuadPlacement,
} from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import type { FrontEndAudioCase } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

const SCAN_CODE_INPUTS: Readonly<Record<number, FrontEndInput>> = {
  200: 'up',
  208: 'down',
  203: 'left',
  205: 'right',
  28: 'accept',
  1: 'back',
}
const DOWN = 208
const ENTER = 28
const FIRST_KEY_FRAME = 250
const KEY_SPACING_FRAMES = 20
const SETTLE_FRAMES = 60
const FRAME_MILLISECONDS = 33
const POSITION_TOLERANCE_PIXELS = 1
// The main menu matches except for the images the original cuts into 512 pixel tiles; the other screens' differences
// (frames drawn as stretched strips, centred titles, the options layout) are listed in render-trace.md.
const MENU_MATCHED_SHARE = 0.85

const FRONT_END_CASES: readonly FrontEndAudioCase[] = [
  { name: 'main menu', scanCodes: [] },
  { name: 'circuit race', scanCodes: [DOWN, ENTER] },
  { name: 'single race', scanCodes: [DOWN, DOWN, ENTER] },
  { name: 'options', scanCodes: [DOWN, DOWN, DOWN, DOWN, ENTER] },
]

const getPortQuads = (commands: readonly FrontEndDrawCommand[]): readonly QuadPlacement[] =>
  commands.flatMap((command): readonly QuadPlacement[] => {
    switch (command.kind) {
      case 'image':
        return [
          {
            left: command.left,
            top: command.top,
            right: command.left + command.width,
            bottom: command.top + command.height,
            textureKey: command.imageName,
            source: command.imageName,
          },
        ]
      case 'text':
        return command.glyphs.map((glyph) => ({
          ...glyph.destination,
          textureKey: command.fontName,
          source: command.fontName,
        }))
      case 'fill':
        return [{ ...command.rectangle, textureKey: null, source: 'fill' }]
      case 'viewport':
        return []
    }
  })

// Every image and font image of the menus, by name, for the texture matching.
const getPortTextures = (
  resources: FrontEndResources,
  commandSets: readonly (readonly FrontEndDrawCommand[])[]
): ReadonlyMap<string, PortTexture> => {
  const names = new Set(
    commandSets.flat().flatMap((command) => {
      if (command.kind === 'image') return [command.imageName]
      return command.kind === 'text' ? [command.fontName] : []
    })
  )
  return new Map(
    [...names].flatMap((name) => {
      const image = resources.getImage(name) ?? resources.getFontImage(name)
      return image === null
        ? []
        : [[name, { width: image.width, height: image.height, colors: image.colors }] as const]
    })
  )
}

const MATRIX_SIZE = 16
const FIGURE_PLACE_TOLERANCE = 0.01

// The figure's root frame (0x0047df90) in world space is where some original draw's frame puts its origin: that draw's
// model matrix translation is the root position times the draw's camera (clip) matrix, as row vectors.
const getIsFigureAtOriginalPlace = (
  commands: readonly FrontEndDrawCommand[],
  frame: OriginalRenderFrame | undefined
): boolean => {
  const driver = commands.flatMap((command) =>
    command.kind === 'viewport' && command.driver !== null ? [command.driver] : []
  )[0]
  if (driver === undefined || frame === undefined) return false
  const [x, y, z] = driver.position
  return frame.draws.some((draw) => {
    if (draw.clipMatrix.length !== MATRIX_SIZE || draw.modelMatrix.length !== MATRIX_SIZE) return false
    return [0, 1, 2, 3].every((column) => {
      const at = (row: number): number => draw.clipMatrix[row * 4 + column] ?? 0
      const expected = x * at(0) + y * at(1) + z * at(2) + at(3)
      return Math.abs(expected - (draw.modelMatrix[12 + column] ?? 0)) < FIGURE_PLACE_TOLERANCE
    })
  })
}

describe.skipIf(!isGamePresent())('front end render trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)`, not `it.each(...)(...)`
  it.each(FRONT_END_CASES)('compares the pictures of $name', async (frontEndCase) => {
    // Arrange
    const lastKeyFrame = FIRST_KEY_FRAME + KEY_SPACING_FRAMES * frontEndCase.scanCodes.length
    const recordFrame = lastKeyFrame + SETTLE_FRAMES
    const frames = Array.from({ length: recordFrame + 1 }, (_, frame) => {
      const keyIndex = (frame - FIRST_KEY_FRAME) / KEY_SPACING_FRAMES
      const scanCode = Number.isInteger(keyIndex) ? frontEndCase.scanCodes[keyIndex] : undefined
      return {
        milliseconds: FRAME_MILLISECONDS,
        scanCodes: scanCode === undefined ? [] : [scanCode],
      }
    })
    const archive = openJamArchive(readOriginalJam())
    const resources = loadFrontEndResources(archive)
    const environment: FrontEndEnvironment = {
      controllerCount: 1,
      unlockedCircuitMask: 0x7f,
      randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
      isEveryPartUnlocked: true,
      playerRacerNames: [],
      standingRows: [],
    }

    // Act
    const original = await readOriginalFrontEnd({
      name: frontEndCase.name,
      frames,
      recordFrames: [recordFrame],
      isRenderRecorded: true,
    })
    let state = createFrontEnd(resources, environment)
    for (const frame of frames.slice(FIRST_KEY_FRAME)) {
      const scanCode = frame.scanCodes[0]
      state = stepFrontEnd(
        state,
        resources,
        environment,
        scanCode === undefined ? null : (SCAN_CODE_INPUTS[scanCode] ?? null),
        frame.milliseconds
      ).state
    }
    const { commands } = getFrontEndFrame(state, resources, environment)
    const originalFrame = original.renderFrames.find((candidate) => candidate.frame === recordFrame)
    const comparison = compareQuadPlacements({
      original: originalFrame === undefined ? [] : getOriginalQuads(originalFrame),
      port: getPortQuads(commands),
      textureMatches: matchTextures(original.textures, getPortTextures(resources, [commands])),
      tolerancePixels: POSITION_TOLERANCE_PIXELS,
    })

    // Assert
    expect(comparison.originalCount).toBeGreaterThan(0)
    if (frontEndCase.name === 'main menu') {
      expect(comparison.matchedCount / comparison.originalCount).toBeGreaterThan(MENU_MATCHED_SHARE)
      expect(getIsFigureAtOriginalPlace(commands, originalFrame)).toBe(true)
    }
  })
})
