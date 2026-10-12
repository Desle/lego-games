import {
  createScreenFader,
  getIsScreenFaderActive,
  getScreenFadeAlpha,
  startScreenFade,
  updateScreenFader,
} from './screen-fader.ts'
import type { ScreenFader } from './screen-fader.types.ts'

const FRAME_MILLISECONDS = 33
const WARP_COLOUR = Object.freeze({ red: 0, green: 0, blue: 0x64 })
const WARP_REQUEST = Object.freeze({ milliseconds: 200, isFadingOut: false, playerIndex: 0 })

const getAlphas = (fader: ScreenFader): readonly number[] =>
  fader.filter((fade) => fade.isActive).map((fade) => getScreenFadeAlpha(fade))

describe('the screen fader', () => {
  it('starts with two entries, none in use', () => {
    // Arrange / Act
    const fader = createScreenFader()

    // Assert
    expect(fader).toHaveLength(2)
    expect(getIsScreenFaderActive(fader)).toBe(false)
  })

  it('gives the original warp fade alphas, one frame at a time (render trace of frames 315 to 322)', () => {
    // Arrange
    let fader = startScreenFade(createScreenFader(), WARP_REQUEST, WARP_COLOUR)

    // Act
    const alphas = Array.from({ length: 9 }, () => {
      fader = updateScreenFader(fader, FRAME_MILLISECONDS)
      return getAlphas(fader)
    })

    // Assert
    expect(alphas).toEqual([[42], [84], [126], [168], [210], [252], [255], [255], []])
  })

  it('fades a colour away from opaque to clear when asked to fade out', () => {
    // Arrange
    const fader = startScreenFade(
      createScreenFader(),
      { milliseconds: 500, isFadingOut: true, playerIndex: null },
      { red: 0, green: 0, blue: 0 }
    )

    // Act
    const alphas = [0, 250, 500].map((elapsed) => getAlphas(updateScreenFader(fader, elapsed)))

    // Assert
    expect(alphas).toEqual([[255], [127], [0]])
  })

  it('takes the second entry when the first is in use and refuses a third', () => {
    // Arrange
    const once = startScreenFade(createScreenFader(), WARP_REQUEST, WARP_COLOUR)
    const twice = startScreenFade(once, WARP_REQUEST, WARP_COLOUR)

    // Act
    const thrice = startScreenFade(twice, WARP_REQUEST, WARP_COLOUR)

    // Assert
    expect(twice.filter((fade) => fade.isActive)).toHaveLength(2)
    expect(thrice).toBe(twice)
  })
})
