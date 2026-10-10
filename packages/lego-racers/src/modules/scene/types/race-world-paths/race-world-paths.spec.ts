import {
  getRaceBackgroundWorldPath,
  getRaceSkyPath,
  getRaceWorldPaths,
} from './race-world-paths.ts'

describe('getRaceWorldPaths', () => {
  it('orders the worlds as 0x00432e20 loads them, the global one from the common directory', () => {
    // Arrange
    const names = {
      globalWorld: 'global.wdf',
      trackWorld: 'rrtrk.wdf',
      collisionWorld: 'collide.wdf',
      blendedWorld: 'blended.wdf',
      localWorld: null,
    }

    // Act
    const paths = getRaceWorldPaths('GAMEDATA\\RACEC0R0', names)

    // Assert
    expect(paths).toEqual([
      'GAMEDATA\\COMMON\\GLOBAL.WDB',
      'GAMEDATA\\RACEC0R0\\RRTRK.WDB',
      'GAMEDATA\\RACEC0R0\\COLLIDE.WDB',
      'GAMEDATA\\RACEC0R0\\BLENDED.WDB',
    ])
  })
})

describe('getRaceSkyPath and getRaceBackgroundWorldPath', () => {
  it('open the sky and the background world of the race directory with their default extensions', () => {
    // Arrange
    const names = { sky: 'backgrnd.sky', backgroundWorld: 'backgrd.wdf' }

    // Act
    const sky = getRaceSkyPath('GAMEDATA\\RACEC0R0', names)
    const backgroundWorld = getRaceBackgroundWorldPath('GAMEDATA\\RACEC0R0', names)

    // Assert
    expect(sky).toBe('GAMEDATA\\RACEC0R0\\BACKGRND.SKB')
    expect(backgroundWorld).toBe('GAMEDATA\\RACEC0R0\\BACKGRD.WDB')
  })

  it('give nothing for names the race description leaves out', () => {
    // Arrange
    const names = { sky: null, backgroundWorld: null }

    // Act
    // Assert
    expect(getRaceSkyPath('GAMEDATA\\RACEC0R0', names)).toBeNull()
    expect(getRaceBackgroundWorldPath('GAMEDATA\\RACEC0R0', names)).toBeNull()
  })
})
