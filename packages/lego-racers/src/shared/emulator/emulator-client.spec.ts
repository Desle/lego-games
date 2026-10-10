import { getIsEmulatorAvailable, openEmulatorSession } from './emulator-client.ts'
import { getBitsFromFloat } from './float-bits.ts'
import type { EmulatorCall, EmulatorPrecision } from './emulator-client.types.ts'

const NORMALIZE_VECTOR3_ADDRESS = 0x004492d0

const getNormalizeCall = (precision: EmulatorPrecision): EmulatorCall => ({
  address: NORMALIZE_VECTOR3_ADDRESS,
  convention: 'fastcall',
  precision,
  arguments: [{ buffer: 'source' }, { buffer: 'target' }],
  buffers: [
    { name: 'source', words: [1, 2, 3].map(getBitsFromFloat), isRead: false },
    { name: 'target', size: 12, isRead: true },
  ],
})

describe('the emulator', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'honours x87 precision control: normalize(1, 2, 3) differs in the last bit of z',
    async () => {
      // Arrange
      const session = openEmulatorSession()

      // Act
      const results = await session
        .callBatch([getNormalizeCall('single'), getNormalizeCall('double')])
        .finally(() => session.close())
      const [singleZ, doubleZ] = results.map((result) => result.buffers['target']?.[2])

      // Assert
      expect(singleZ).toBe(0x3f4d41b2)
      expect(doubleZ).toBe(0x3f4d41b3)
    }
  )

  it.skipIf(!getIsEmulatorAvailable())('leaves the x87 stack empty after a call', async () => {
    // Arrange
    const session = openEmulatorSession()

    // Act
    const [result] = await session
      .callBatch([getNormalizeCall('single')])
      .finally(() => session.close())

    // Assert
    expect(result?.fpuStackDepth).toBe(0)
  })

  it.skipIf(!getIsEmulatorAvailable())('aborts with the name of an unstubbed import', async () => {
    // Arrange: 0x004a84b0 jumps through the import table entry of _ftol, which is stubbed; 0x004a84b6 is not.
    const session = openEmulatorSession()
    const call: EmulatorCall = {
      address: 0x004a84b6,
      convention: 'cdecl',
      precision: 'single',
      arguments: [],
      buffers: [],
    }

    // Act
    const failure = await session
      .callBatch([call])
      .then(() => null)
      .catch((error: unknown) => error)
      .finally(() => session.close())

    // Assert
    expect(String(failure)).toContain('unstubbed import')
  })
})
