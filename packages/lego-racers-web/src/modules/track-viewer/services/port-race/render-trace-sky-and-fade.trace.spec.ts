import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import type { OriginalRenderFrame } from '@lego-games/lego-racers/presentation-trace'
import { readOriginalPresentation } from '@lego-games/lego-racers/presentation-trace'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { ORIGINAL_STAGE_SIZE, runPortRace } from './port-race.ts'
import { compareWorldFrame, getSceneTextures } from './render-comparison.ts'
import { createPresentationScenario } from './trace-scenarios.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

// Direct3D render state numbers (original-triangles.ts): Z_ENABLE, Z_WRITE_ENABLE, ALPHA_BLEND_ENABLE, SOURCE_BLEND,
// DESTINATION_BLEND; stage 0 colour operation 3 is "select diffuse" (vertex colour only).
const Z_ENABLE = '7'
const Z_WRITE_ENABLE = '14'
const ALPHA_BLEND_ENABLE = '27'
const SOURCE_BLEND = '19'
const DESTINATION_BLEND = '20'
const COLOR_OPERATION = '0.1'
const SELECT_DIFFUSE = 3
const SOURCE_ALPHA = 5
const INVERSE_SOURCE_ALPHA = 6
const ALPHA_SHIFT = 24
const BYTE_MASK = 0xff
const SCREEN_QUAD_TRIANGLE_COUNT = 2

const FADE_FRAMES = [3, 5, 8, 12, 15, 16, 17, 18] as const
const FADE_RACE = 'RACEC0R0'
const SKY_RACES = ['RACEC0R0', 'RACEC1R0', 'RACEC3R0'] as const
const SKY_FRAME = 100

const getRenderFrame = (
  frames: readonly OriginalRenderFrame[],
  frame: number
): OriginalRenderFrame => {
  const found = frames.find((candidate) => candidate.frame === frame)
  if (found === undefined) throw new Error(`The original recorded no frame ${String(frame)}`)
  return found
}

// The last two draws of a frame are the fader's quad when one runs (0x004905e0): a black blend of the source alpha over
// the whole view without depth. Returns its alpha, or null when the frame's last draws are something else.
const getFadeQuadAlpha = (frame: OriginalRenderFrame): number | null => {
  const lastDraws = frame.draws.slice(-SCREEN_QUAD_TRIANGLE_COUNT)
  const alphas = lastDraws.map((draw) => {
    const state = frame.states[draw.stateIndex]
    const vertex = draw.vertices[0]
    const isFadeState =
      state !== undefined &&
      state.render[ALPHA_BLEND_ENABLE] === 1 &&
      state.render[Z_ENABLE] === 0 &&
      state.render[SOURCE_BLEND] === SOURCE_ALPHA &&
      state.render[DESTINATION_BLEND] === INVERSE_SOURCE_ALPHA &&
      draw.vertices.length === 3
    if (!isFadeState || vertex === undefined || (vertex.diffuse & 0xffffff) !== 0) return null
    return (vertex.diffuse >>> ALPHA_SHIFT) & BYTE_MASK
  })
  const [first, second] = alphas
  return first !== undefined && first === second ? first : null
}

describe.skipIf(!isGamePresent())('sky and screen fade against the original', () => {
  it.each([0, 1])(
    'draws the race start fade with the original alpha on every frame (%s local players)',
    async (localPlayerCount) => {
      // Arrange
      const jam = readOriginalJam()
      const scenario = createPresentationScenario(jam, {
        name: 'fade',
        raceFolder: FADE_RACE,
        localPlayerCount,
        frameCount: Math.max(...FADE_FRAMES) + 1,
        recordFrames: FADE_FRAMES,
        isRenderRecorded: true,
      })
      const original = await readOriginalPresentation(scenario)
      const assets = loadScenarioAssets(jam, scenario)
      const pairs: { frame: number; originalAlpha: number | null; portAlpha: number | null }[] = []

      // Act
      runPortRace(assets, scenario.frames, (portFrame) => {
        if (!FADE_FRAMES.some((frame) => frame === portFrame.frame)) return
        const fades = portFrame.presentation.screenFades
        pairs.push({
          frame: portFrame.frame,
          originalAlpha: getFadeQuadAlpha(getRenderFrame(original.renderFrames, portFrame.frame)),
          portAlpha: fades[0]?.alpha ?? null,
        })
      })

      // Assert
      expect(pairs.map((pair) => pair.frame)).toEqual([...FADE_FRAMES])
      expect(pairs.map((pair) => pair.portAlpha)).toEqual(pairs.map((pair) => pair.originalAlpha))
      expect(pairs[0]?.originalAlpha).toBeGreaterThan(0)
      expect(pairs.at(-1)?.originalAlpha).toBeNull()
    }
  )

  it.each(SKY_RACES)(
    'draws the sky dome of %s with the original draw state: vertex colours, no depth',
    async (raceFolder) => {
      // Arrange
      const jam = readOriginalJam()
      const scenario = createPresentationScenario(jam, {
        name: 'sky',
        raceFolder,
        frameCount: SKY_FRAME + 1,
        recordFrames: [SKY_FRAME],
        isRenderRecorded: true,
      })
      const original = await readOriginalPresentation(scenario)
      const assets = loadScenarioAssets(jam, scenario)
      const stage = createRaceStage(assets, ORIGINAL_STAGE_SIZE)
      const sceneTextures = getSceneTextures(assets)
      const originalFrame = getRenderFrame(original.renderFrames, SKY_FRAME)
      const firstWorldDraw = originalFrame.draws.findIndex(
        (draw) => originalFrame.states[draw.stateIndex]?.render[Z_ENABLE] === 1
      )
      const skyDraws = originalFrame.draws.slice(0, firstWorldDraw)
      let portSkyStates: readonly {
        isDepthTestEnabled: boolean
        isDepthWriteEnabled: boolean
        colorOperation: string
        textureKey: string | null
      }[] = []

      // Act
      runPortRace(assets, scenario.frames, (portFrame) => {
        const world = compareWorldFrame({
          stage,
          portFrame,
          original,
          sceneTextures,
          candidateCount: 1,
        })
        if (world === null) return
        portSkyStates = world.portTriangles.triangles
          .filter((triangle) => triangle.source.includes('skymat'))
          .map((triangle) => ({
            isDepthTestEnabled: triangle.state.isDepthTestEnabled,
            isDepthWriteEnabled: triangle.state.isDepthWriteEnabled,
            colorOperation: triangle.state.colorOperation,
            textureKey: triangle.textureKey,
          }))
      })

      // Assert
      expect(skyDraws.length).toBeGreaterThan(0)
      for (const draw of skyDraws) {
        const state = originalFrame.states[draw.stateIndex]
        expect(state?.render[Z_ENABLE]).toBe(0)
        expect(state?.render[Z_WRITE_ENABLE]).toBe(0)
      }
      const [firstDraw] = skyDraws
      expect(originalFrame.states[firstDraw?.stateIndex ?? -1]?.stage[COLOR_OPERATION]).toBe(
        SELECT_DIFFUSE
      )
      expect(portSkyStates.length).toBeGreaterThan(0)
      for (const portState of portSkyStates) {
        expect(portState).toEqual({
          isDepthTestEnabled: false,
          isDepthWriteEnabled: false,
          colorOperation: 'select_diffuse',
          textureKey: null,
        })
      }
    }
  )
})
