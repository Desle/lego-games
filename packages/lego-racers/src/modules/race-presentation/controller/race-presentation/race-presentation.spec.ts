import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  loadRaceDefinition,
  NO_RACE_CONTACTS,
  stepRace,
} from '../../../race/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { HudFont } from '../../../race-hud/index.ts'
import { getRacerPoses } from '../get-racer-poses/get-racer-poses.ts'
import type { HudContext, RacePresentationFrame } from '../../types/race-presentation.types.ts'
import { getHudLayout } from '../../../race-hud/index.ts'
import { createRacePresentation, stepRacePresentation } from './race-presentation.ts'

const GAME_FILES = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/'
)
const isOriginalPresent =
  existsSync(resolve(GAME_FILES, 'LEGO.JAM')) && existsSync(resolve(GAME_FILES, 'LEGORacers.exe'))

const measureText = (font: string, text: string) => ({
  width: text.length * (font === HudFont.DIGITS ? 30 : 10),
  height: 16,
})
const getString = (stringId: number) => `string ${String(stringId)}`
const hudContext: HudContext = {
  layout: getHudLayout({
    screenWidth: 640,
    screenHeight: 480,
    measureText,
    getString,
    holderSize: { width: 64, height: 64 },
  }),
  getString,
  imageNames: [],
  getImageSize: () => null,
  measureText,
}

describe.runIf(isOriginalPresent)('stepRacePresentation on Royal Knights Raceway', () => {
  const definition = isOriginalPresent
    ? loadRaceDefinition(
        new Uint8Array(readFileSync(resolve(GAME_FILES, 'LEGO.JAM'))),
        new Uint8Array(readFileSync(resolve(GAME_FILES, 'LEGORacers.exe')))
      )
    : null

  const drive = (frameCount: number) => {
    if (definition === null) throw new Error('The original files are missing')
    let raceState: RaceState = createRace(definition)
    const started = createRacePresentation(raceState, 7)
    let presentation = started.presentation
    const frames: RacePresentationFrame[] = []
    const controls = { ...IDLE_RACER_CONTROLS, isAcceleratePressed: true }
    for (let frame = 0; frame < frameCount; frame += 1) {
      const step = stepRace(raceState, { controls: [controls], contacts: NO_RACE_CONTACTS }, 16)
      raceState = step.raceState
      const result = stepRacePresentation(presentation, step, controls, 16, hudContext)
      presentation = result.presentation
      frames.push(result)
    }
    return { raceState, frames, started }
  }

  it('starts with the introduction music and no HUD', () => {
    // Arrange / Act
    const { frames, started } = drive(10)

    // Assert
    expect(started.music).toMatchObject({ listIndex: 0, isLooping: false })
    expect(frames[0]?.hudFrame).toBeNull()
  })

  it('keeps the chase camera behind and above the player and looking at it', () => {
    // Arrange / Act
    const { raceState, frames } = drive(400)

    // Assert
    const player = getRacerPoses(raceState).find((pose) => pose.isPlayer)
    const view = frames.at(-1)?.cameraView
    expect(player).toBeDefined()
    expect(view).toBeDefined()
    if (player === undefined || view === undefined) return
    const distance = Math.hypot(
      view.position.x - player.position.x,
      view.position.y - player.position.y,
      view.position.z - player.position.z
    )
    expect(distance).toBeGreaterThan(10)
    expect(distance).toBeLessThan(35)
    expect(view.position.z).toBeGreaterThan(player.position.z)
  })

  it('counts the race in with the second tick, GO and the racing music', () => {
    // Arrange / Act
    const { frames } = drive(330)

    // Assert
    const soundIds = frames.flatMap((frame) => frame.sounds.map((sound) => sound.soundId))
    expect(soundIds.filter((soundId) => soundId === 0).length).toBeGreaterThanOrEqual(3)
    expect(soundIds).toContain(0x3e)
    expect(soundIds).toContain(0xf)
    const music = frames.flatMap((frame) => (frame.music === null ? [] : [frame.music]))
    expect(music).toHaveLength(1)
    expect(music[0]).toMatchObject({ isLooping: true })
    expect([1, 4, 5, 6]).toContain(music[0]?.listIndex)
  })

  it('shows the HUD from the countdown on with the countdown numerals', () => {
    // Arrange / Act
    const { frames } = drive(200)

    // Assert
    const numerals = frames.flatMap((frame) =>
      (frame.hudFrame?.commands ?? []).flatMap((command) =>
        command.kind === 'text' && command.font === HudFont.DIGITS ? [command.text] : []
      )
    )
    expect(numerals).toContain('3')
    expect(numerals).toContain('2')
  })
})
