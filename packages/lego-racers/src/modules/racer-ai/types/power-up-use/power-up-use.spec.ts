import { createRandomTable } from '../../../random-table/index.ts'
import { decidePowerUpUse, updatePowerUpUse } from './power-up-use.ts'
import { PowerUpUseDecision } from './power-up-use-decision.ts'

// Synthetic table (value = index): drawing from position p reads p + 1, whose low byte is the roll.
const TABLE = createRandomTable(Array.from({ length: 1024 }, (_, index) => index))
const INPUT = Object.freeze({
  heldPowerUp: 2,
  preferredPowerUp: 0,
  preferredLevel: 0,
  powerUpLevel: 0,
  personality: { chances: [10, 20, 30, 40, 0, 0], combinedChance: 0 },
  activePowerUpCount: 0,
  racerFlags: 0,
  carBodyFlags: 0,
  isTargetAhead: false,
})

describe('decidePowerUpUse', () => {
  it('uses power-up 2 when the low byte is below chance +0xd1f, else waits', () => {
    // Arrange
    const low = 38
    const high = 39

    // Act
    const used = decidePowerUpUse(TABLE, low, INPUT)
    const waited = decidePowerUpUse(TABLE, high, INPUT)

    // Assert
    expect(used).toEqual({ position: 39, decision: PowerUpUseDecision.USE })
    expect(waited).toEqual({ position: 40, decision: PowerUpUseDecision.WAIT })
  })

  it('keeps power-up 1 without drawing when no racer is ahead', () => {
    // Arrange
    const input = { ...INPUT, heldPowerUp: 1 }

    // Act
    const result = decidePowerUpUse(TABLE, 0, input)

    // Assert
    expect(result).toEqual({ position: 0, decision: PowerUpUseDecision.KEEP })
  })

  it('waits without drawing when 20 power-ups are active or the preferred level is not reached', () => {
    // Arrange
    const crowded = { ...INPUT, activePowerUpCount: 20 }
    const saving = { ...INPUT, preferredPowerUp: 2, preferredLevel: 3, powerUpLevel: 1 }

    // Act
    const crowdedResult = decidePowerUpUse(TABLE, 0, crowded)
    const savingResult = decidePowerUpUse(TABLE, 0, saving)

    // Assert
    expect(crowdedResult).toEqual({ position: 0, decision: PowerUpUseDecision.WAIT })
    expect(savingResult).toEqual({ position: 0, decision: PowerUpUseDecision.WAIT })
  })

  it('keeps power-up 3 after a successful roll while car body bit 0x2 is set', () => {
    // Arrange
    const input = { ...INPUT, heldPowerUp: 3, carBodyFlags: 0x2 }

    // Act
    const result = decidePowerUpUse(TABLE, 0, input)

    // Assert
    expect(result).toEqual({ position: 1, decision: PowerUpUseDecision.KEEP })
  })
})

describe('updatePowerUpUse', () => {
  it('checks after more than the interval and waits 1,000 ms after a failed roll', () => {
    // Arrange
    const schedule = { elapsedMilliseconds: 140, intervalMilliseconds: 150 }

    // Act
    const quiet = updatePowerUpUse(TABLE, 50, schedule, 10, true, INPUT)
    const checked = updatePowerUpUse(TABLE, 50, schedule, 11, true, INPUT)

    // Assert
    expect(quiet).toEqual({
      position: 50,
      schedule: { elapsedMilliseconds: 150, intervalMilliseconds: 150 },
      decision: null,
    })
    expect(checked).toEqual({
      position: 51,
      schedule: { elapsedMilliseconds: 0, intervalMilliseconds: 1000 },
      decision: PowerUpUseDecision.WAIT,
    })
  })
})
