import { getRaceWorldPaths } from './race-world-paths.ts'

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
