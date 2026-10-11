import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import { FrontEndMusic, getFrontEndMusicIndex } from './front-end-music.ts'

describe('getFrontEndMusicIndex', () => {
  it('starts the theme on the main menu and the builder tune in the garage', () => {
    // Arrange / Act
    const menu = getFrontEndMusicIndex(FrontEndScreen.MAIN_MENU, null)
    const garage = getFrontEndMusicIndex(FrontEndScreen.GARAGE, FrontEndMusic.THEME)

    // Assert
    expect(menu).toBe(FrontEndMusic.THEME)
    expect(garage).toBe(FrontEndMusic.BUILDER)
  })

  it('lets the tune play on when it is the screen’s own or the screen names none', () => {
    // Arrange / Act
    const sameTune = getFrontEndMusicIndex(FrontEndScreen.MAIN_MENU, FrontEndMusic.THEME)
    const race = getFrontEndMusicIndex(FrontEndScreen.SINGLE_RACE, FrontEndMusic.THEME)

    // Assert
    expect(sameTune).toBeNull()
    expect(race).toBeNull()
  })

  it('picks the award, circuit introduction and introduction tunes by screen id', () => {
    // Arrange / Act
    const award = getFrontEndMusicIndex(FrontEndScreen.CIRCUIT_AWARD_FOUR, null)
    const circuit = getFrontEndMusicIndex(FrontEndScreen.CIRCUIT_ONE_INTRODUCTION + 2, null)
    const credits = getFrontEndMusicIndex(FrontEndScreen.CREDITS, null)

    // Assert
    expect(award).toBe(0xb)
    expect(circuit).toBe(7)
    expect(credits).toBe(0x11)
  })
})
