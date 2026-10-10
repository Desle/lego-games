import { createPowerUpWorld, getStepWithAttachmentSlot } from '../../../power-ups/index.ts'
import type { PowerUpStep } from '../../../power-ups/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createDebrisPool, DebrisState, getThrownDebris, getUpdatedDebris } from './debris.ts'
import type { DebrisAnimations, DebrisPool } from './debris.types.ts'

const ANIMATIONS: DebrisAnimations = [[100, 200], [300], [400, 500, 600], [700]]

const getStep = (): PowerUpStep =>
  createPowerUpWorld({
    bricks: [],
    enhancementBricks: [],
    raceModeFlags: 0,
    isSplitScreen: true,
    racers: [],
    random: { table: createRandomTable(Array.from({ length: 1024 }, () => 0)), position: 0 },
  })

const getThrown = (count: number): { readonly step: PowerUpStep; readonly pool: DebrisPool } =>
  Array.from({ length: count }).reduce<{ readonly step: PowerUpStep; readonly pool: DebrisPool }>(
    (current) => getThrownDebris(current.step, current.pool, ANIMATIONS),
    { step: getStep(), pool: createDebrisPool() }
  )

describe('getThrownDebris (0x004517c0)', () => {
  it('takes the first free piece, the lowest attachment slot and the next model, in turn', () => {
    // Arrange / Act
    const thrown = getThrown(3)

    // Assert: models 0, 1, 2 with animations 0 % 2, 1 % 1 and 2 % 3 of their lists.
    expect(thrown.pool.pieces.slice(0, 3)).toMatchObject([
      { state: DebrisState.PLAYING, slotIndex: 0, durationMilliseconds: 100 },
      { state: DebrisState.PLAYING, slotIndex: 1, durationMilliseconds: 300 },
      { state: DebrisState.PLAYING, slotIndex: 2, durationMilliseconds: 600 },
    ])
    expect(thrown.pool.nextModel).toBe(3)
    expect(thrown.pool.thrownCount).toBe(3)
    expect(thrown.step.world.effects.attachmentSlots.usedCount).toBe(3)
  })

  it('wraps the model after four pieces', () => {
    // Arrange / Act
    const thrown = getThrown(4)

    // Assert
    expect(thrown.pool.nextModel).toBe(0)
  })

  it('throws nothing when all five pieces are playing', () => {
    // Arrange
    const full = getThrown(5)

    // Act
    const sixth = getThrownDebris(full.step, full.pool, ANIMATIONS)

    // Assert
    expect(sixth.pool).toBe(full.pool)
    expect(sixth.step.world.effects.attachmentSlots.usedCount).toBe(5)
  })

  it('throws nothing when no attachment slot is free', () => {
    // Arrange: take all 25 slots first.
    const exhausted = Array.from({ length: 25 }).reduce<PowerUpStep>(
      (step) => getStepWithAttachmentSlot(step).step,
      getStep()
    )

    // Act
    const thrown = getThrownDebris(exhausted, createDebrisPool(), ANIMATIONS)

    // Assert
    expect(thrown.pool.pieces.every((piece) => piece.state === DebrisState.IDLE)).toBe(true)
    expect(thrown.pool.thrownCount).toBe(0)
  })
})

describe('getUpdatedDebris (0x00451860)', () => {
  it('plays a piece until its animation ends, then frees its slot and the piece', () => {
    // Arrange
    const thrown = getThrown(2)

    // Act
    const playing = getUpdatedDebris(thrown.step, thrown.pool, 99)
    const ended = getUpdatedDebris(playing.step, playing.pool, 1)

    // Assert: piece 0 lasts 100 ms, piece 1 300 ms.
    expect(playing.pool.pieces[0]?.state).toBe(DebrisState.PLAYING)
    expect(ended.pool.pieces[0]?.state).toBe(DebrisState.IDLE)
    expect(ended.pool.pieces[1]?.state).toBe(DebrisState.PLAYING)
    expect(ended.step.world.effects.attachmentSlots.usedCount).toBe(1)
  })
})
