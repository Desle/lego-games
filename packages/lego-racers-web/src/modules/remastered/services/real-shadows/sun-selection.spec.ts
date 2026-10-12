import { Group } from 'three'
import { getManualSun, getTrackSun, getTrackSunKey } from './sun-selection.ts'

describe('getTrackSunKey', () => {
  it('names a track by the folder of its world', () => {
    // Arrange / Act
    const key = getTrackSunKey('GAMEDATA\\RACEC0R0\\RACEC0R0.GDB')

    // Assert
    expect(key).toBe('racec0r0')
  })
})

describe('getManualSun', () => {
  it('reads the azimuth, the elevation and the ambient share from the address', () => {
    // Arrange / Act
    const sun = getManualSun('?hd&sun=90,30,0.4')

    // Assert
    expect(sun?.direction[0]).toBeCloseTo(0, 5)
    expect(sun?.direction[1]).toBeCloseTo(Math.cos(Math.PI / 6), 5)
    expect(sun?.direction[2]).toBeCloseTo(0.5, 5)
    expect(sun?.ambientShare).toBe(0.4)
  })

  it('has no opinion without a sun parameter or with a broken one', () => {
    // Arrange / Act
    const suns = ['?hd', '?hd&sun=estimate', '?hd&sun=north,up'].map(getManualSun)

    // Assert
    expect(suns).toEqual([null, null, null])
  })
})

describe('getTrackSun', () => {
  it('takes the manual sun over the stored and the default one', () => {
    // Arrange / Act
    const sun = getTrackSun('?hd&sun=0,90,0.5', 'GAMEDATA\\RACEC0R0\\X.GDB', new Group())

    // Assert
    expect(sun.direction[2]).toBeCloseTo(1, 5)
  })

  it('falls back to a sun above the horizon for a track with none stored', () => {
    // Arrange / Act
    const sun = getTrackSun('?hd', 'GAMEDATA\\RACEC9R9\\X.GDB', new Group())

    // Assert
    expect(sun.direction[2]).toBeGreaterThan(0)
  })
})
