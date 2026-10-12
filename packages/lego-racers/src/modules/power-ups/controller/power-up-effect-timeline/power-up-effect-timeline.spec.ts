import { createEmitterPool } from '../../../emitter/index.ts'
import type { Emitter } from '../../../emitter/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind, RaceModeFlag } from '../../types/brick-kind/brick-kind.ts'
import { EffectState } from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type {
  ActivationRequest,
  PowerUpEffect,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import { activatePowerUp } from '../activate-power-up/activate-power-up.ts'
import { createPowerUpWorld } from '../power-up-world/power-up-world.ts'
import { getStepWithEffect } from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import { getStepWithInitialWandDraws, updatePowerUpEffects } from './power-up-effect-timeline.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const STATUS: RacerPowerUpStatus = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  isComputer: false,
  isShielded: false,
  shieldLevel: 0,
  isTumbling: false,
  isWarping: false,
  isCursed: false,
  isWarpWithheld: false,
  isWarpPending: false,
  isAirborne: false,
  isStruckByLightning: false,
  isInTurbo: false,
}

const createContext = (raceModeFlags = 0): PowerUpContext => ({
  arithmetic: SINGLE,
  racers: [STATUS],
  raceModeFlags,
  getGroundPoint: () => null,
  trackTargets: [],
})

// Table value = index, so the position after the draws tells how many were made.
const createActivated = (request: ActivationRequest, context = createContext()): PowerUpStep =>
  activatePowerUp(
    createPowerUpWorld({
      bricks: [],
      enhancementBricks: [],
      raceModeFlags: 0,
      isSplitScreen: true,
      racers: [{ voiceSoundBase: 0, voiceCooldownMilliseconds: 0 }],
      random: {
        table: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
        position: 0,
      },
    }),
    context,
    0,
    request
  )

const BUBBLE_EMITTER: Emitter = {
  name: 'oilbub',
  firstTruncatedValue: 100,
  secondTruncatedValue: 0,
  vector: [0, 0, 0],
  points: [[0, 0, 1]],
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 10,
  entryIndex: null,
  firstInteger: 500,
  secondInteger: -1,
  thirdInteger: 1,
  linkedName: null,
}

const getStepWithBubblePool = (step: PowerUpStep): PowerUpStep => ({
  ...step,
  world: {
    ...step.world,
    emitters: {
      common: createEmitterPool({
        list: { emitters: [BUBBLE_EMITTER], readByteCount: 0 },
        instanceCount: 2,
        animation: null,
      }),
      track: null,
    },
  },
})

const getHead = (step: PowerUpStep): PowerUpEffect => {
  const id = step.world.effects.activeEffectIds[0]
  const effect = id === undefined ? undefined : step.world.effects.effects[id]
  if (effect === undefined) throw new Error('no active effect')
  return effect
}

const runFor = (
  step: PowerUpStep,
  context: PowerUpContext,
  steps: readonly number[]
): PowerUpStep =>
  steps.reduce(
    (current, stepMilliseconds) => updatePowerUpEffects(current, context, stepMilliseconds),
    step
  )

describe('updatePowerUpEffects', () => {
  it('runs a level-1 turbo 400 ms, 1500 ms, then 700 ms (0x0045d200)', () => {
    // Arrange
    const context = createContext()
    const step = createActivated({ category: BrickKind.TURBO, level: 1 }, context)

    // Act
    const active = runFor(step, context, [400])
    const ending = runFor(active, context, [1500])
    const finished = runFor(ending, context, [700])

    // Assert
    expect([getHead(active).state, getHead(active).timerMilliseconds]).toEqual([
      EffectState.ACTIVE,
      1500,
    ])
    expect(active.events.at(-1)).toEqual({ type: 'power_ups.voice', racer: 0, sound: 6 + (5 % 6) })
    expect([getHead(ending).state, getHead(ending).timerMilliseconds]).toEqual([
      EffectState.ENDING,
      700,
    ])
    expect(getHead(finished).state).toBe(EffectState.FINISHED)
  })

  it('keeps a level-2 turbo going in the endless-turbo race mode', () => {
    // Arrange
    const context = createContext(RaceModeFlag.ENDLESS_TURBO)
    const step = runFor(
      createActivated({ category: BrickKind.TURBO, level: 2 }, context),
      context,
      [400]
    )

    // Act
    const later = runFor(step, context, [5000])

    // Assert
    expect([getHead(later).state, getHead(later).timerMilliseconds]).toEqual([
      EffectState.ACTIVE,
      5000,
    ])
  })

  it('lowers a shield 1000 ms after it runs out (0x0045c2a0)', () => {
    // Arrange
    const context = createContext()
    const step = createActivated({ category: BrickKind.SHIELD, level: 0 }, context)

    // Act
    const finished = runFor(step, context, [4000, 1000])

    // Assert
    expect(getHead(finished).state).toBe(EffectState.FINISHED)
    expect(finished.events.at(-1)).toEqual({ type: 'power_ups.racer_shield_lowered', racer: 0 })
  })

  it('explodes a landed barrel twice more with scattered offsets 500 ms apart (0x00453240)', () => {
    // Arrange
    const context = createContext()
    const step = createActivated({ category: BrickKind.HAZARD, level: 1 }, context)
    const landed = getStepWithEffect(step, {
      ...getHead(step),
      state: EffectState.ENDING,
      timerMilliseconds: 500,
    })

    // Act
    const exploded = runFor(landed, context, [500, 500])

    // Assert: draws read 41, 42 then 43, 44 (40 draws were made by the split-screen wands).
    expect(
      exploded.events.map((event) => (event.type === 'power_ups.explosion' ? event.offset : null))
    ).toEqual([
      { x: (41 % 13) - 6, y: (42 % 13) - 6, z: 0 },
      { x: (43 % 13) - 6, y: (44 % 13) - 6, z: 0 },
    ])
    expect(getHead(exploded).state).toBe(EffectState.FINISHED)
  })

  it('draws once per 50 ms of a wand, and twice per spark while active (0x00454d70, 0x00454e50)', () => {
    // Arrange
    const context = createContext()
    const step = createActivated({ category: BrickKind.PROJECTILE, level: 2 }, context)

    // Act
    const charging = runFor(step, context, [120])
    const active = runFor(charging, context, [380])

    // Assert: 120 ms give two jitter draws (20 ms left); the charge ends exactly with the next step, so nothing is
    // left for the jitter or the first spark (0x00454d70 passes on only what the countdown did not use).
    expect(charging.world.random.position).toBe(42)
    expect(getHead(active).state).toBe(EffectState.ACTIVE)
    expect(active.world.random.position).toBe(42)
  })

  it('draws twice per frame for a landed oil slick (0x004572a0)', () => {
    // Arrange
    const context = createContext()
    const step = getStepWithBubblePool(
      createActivated({ category: BrickKind.HAZARD, level: 0 }, context)
    )

    // Act
    const landed = runFor(step, context, [20])
    const later = runFor(landed, context, [20])

    // Assert
    expect(getHead(landed)).toMatchObject({ state: EffectState.ACTIVE, timerMilliseconds: 10000 })
    expect(later.world.random.position - landed.world.random.position).toBe(2)
  })
})

describe('getStepWithInitialWandDraws', () => {
  it('draws 20 per wand in the pool', () => {
    // Arrange
    const step = createActivated({ category: BrickKind.HAZARD, level: 0 })

    // Act
    const drawn = getStepWithInitialWandDraws(step)

    // Assert
    expect(drawn.world.random.position - step.world.random.position).toBe(40)
  })
})
