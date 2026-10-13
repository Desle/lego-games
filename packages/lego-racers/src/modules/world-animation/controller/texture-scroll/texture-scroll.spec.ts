import { advanceWorldAnimation } from '../world-animation/world-animation.ts'
import { EMPTY_WORLD_ANIMATION } from '../world-animation/world-animation.ts'
import {
  createTextureScroll,
  getAdvancedTextureScroll,
  getTextureScrollOffsets,
  NO_TEXTURE_SCROLL,
} from './texture-scroll.ts'

describe('texture scroll', () => {
  it('has no rates without keyword 0x3f', () => {
    // Arrange / Act
    const scroll = createTextureScroll(null)

    // Assert
    expect(scroll).toBe(NO_TEXTURE_SCROLL)
  })

  it('turns a scroll per second into a rate of 65.535 words per millisecond', () => {
    // Arrange / Act
    const scroll = createTextureScroll([1, -2])

    // Assert
    expect(scroll).toEqual({ offsetU: 0, offsetV: 0, rateU: 65, rateV: -131 })
  })

  it('adds the product of the milliseconds and the rate, wrapping at 16 bits', () => {
    // Arrange
    const scroll = createTextureScroll([4, -1])

    // Act
    const advanced = getAdvancedTextureScroll(getAdvancedTextureScroll(scroll, 33), 33)

    // Assert
    expect(advanced).toEqual({
      offsetU: (262 * 66) % 65536,
      offsetV: 65536 - 65 * 66,
      rateU: 262,
      rateV: -65,
    })
  })

  it('leaves a scroll without rates alone', () => {
    // Arrange / Act
    const advanced = getAdvancedTextureScroll(NO_TEXTURE_SCROLL, 33)

    // Assert
    expect(advanced).toBe(NO_TEXTURE_SCROLL)
  })

  it('draws a word of 65536 as one whole texture', () => {
    // Arrange
    const scroll = { offsetU: 0x8000, offsetV: 0x4000, rateU: 0, rateV: 0 }

    // Act
    const offsets = getTextureScrollOffsets(scroll)

    // Assert
    expect(offsets).toEqual([0.5, 0.25])
  })

  it('scrolls the mesh instances of a world as it advances', () => {
    // Arrange
    const world = {
      ...EMPTY_WORLD_ANIMATION,
      meshInstances: [
        {
          name: 'water',
          position: [0, 0, 0] as const,
          levelSquaredDistances: [],
          otherFlags: 0,
          textureScroll: createTextureScroll([1, 0]),
        },
      ],
    }

    // Act
    const advanced = advanceWorldAnimation(world, 100)

    // Assert
    expect(advanced.meshInstances[0]?.textureScroll.offsetU).toBe(6500)
  })

  it("advances the last race's planet (scroll 0.3 per second) by 627/65536 of its texture per 33 ms frame", () => {
    // Arrange
    const scroll = createTextureScroll([0.3, 0])

    // Act
    const advanced = getAdvancedTextureScroll(scroll, 33)

    // Assert
    expect(getTextureScrollOffsets(advanced)[0]).toBeCloseTo(0.009565, 4)
  })
})
