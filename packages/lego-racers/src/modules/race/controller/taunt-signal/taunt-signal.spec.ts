import { sendTauntSignal } from './taunt-signal.ts'

describe('sendTauntSignal', () => {
  it('starts and stops signal 999 at the racer position (0x00439c90, 0x00462580)', () => {
    // Arrange
    const calls: unknown[][] = []
    const session = {
      startStopSignal: (identifier: number, other: number, point: readonly number[] | null) =>
        calls.push([identifier, other, point]),
    }

    // Act
    sendTauntSignal(session, { x: 1, y: 2, z: 3 })

    // Assert
    expect(calls).toEqual([[999, 999, [1, 2, 3]]])
  })
})
