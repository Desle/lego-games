import {
  getLookLabels,
  getLookPreset,
  getLookPresetFromLabel,
  LOOK_APPEARANCES,
} from './ldraw-look.ts'
import { LookPreset } from './ldraw-look.types.ts'

describe('getLookPreset', () => {
  it('reads the look from the address and defaults to the photo look', () => {
    // Arrange / Act
    const presets = [
      '?hd',
      '?hd&look=manual',
      '?hd&look=studio',
      '?hd&look=movie',
      '?look=odd',
    ].map(getLookPreset)

    // Assert
    expect(presets).toEqual([
      LookPreset.PHOTO,
      LookPreset.MANUAL,
      LookPreset.STUDIO,
      LookPreset.MOVIE,
      LookPreset.PHOTO,
    ])
  })
})

describe('look labels', () => {
  it('round-trips the developer panel choices', () => {
    // Arrange / Act
    const labels = getLookLabels()

    // Assert
    expect(labels).toEqual(['Manual', 'Studio', 'Photo', 'LEGO Movie'])
    expect(labels.map(getLookPresetFromLabel)).toEqual(Object.values(LookPreset))
  })
})

describe('look appearances', () => {
  it('keeps the manual look as the original plastic and adds features cumulatively', () => {
    // Arrange / Act
    const { manual, studio, photo, movie } = LOOK_APPEARANCES

    // Assert
    expect(manual.isEdgeVisible).toBe(true)
    expect(manual.isGraded).toBe(false)
    expect([studio.isEdgeVisible, studio.isGraded, studio.occlusionStrength]).toEqual([
      false,
      false,
      0,
    ])
    expect([photo.isGraded, photo.occlusionStrength > 0, photo.catchLightOpacity > 0]).toEqual([
      true,
      true,
      true,
    ])
    expect([photo.wear, movie.wear, movie.warmth > photo.warmth]).toEqual([0, 1, true])
  })
})
