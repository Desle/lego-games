import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import {
  advanceBrickBase,
  AVAILABLE_BRICK_SCALE,
  COLLECT_ANIMATION_MILLISECONDS,
  createBrickBase,
  getIsBrickCollectable,
  getTouchedBrick,
  toVector3,
} from '../brick-base/brick-base.ts'
import { BrickKind, getBrickKindFromCode, getRaceModeBrickKind } from '../brick-kind/brick-kind.ts'
import { BrickState } from '../power-up-effect-kind/power-up-effect-kind.ts'
import type { PowerUpBrick, PowerUpBrickPlacement, RacerPowerUps } from '../power-ups.types.ts'
import { getRacerWithBrick } from '../racer-power-ups/racer-power-ups.ts'
import type { PowerUpBrickTouchResult } from './power-up-brick.types.ts'

// 0x00453970: +0x48.
const RESPAWN_DELAY_MILLISECONDS = 3000
// 0x1f5 in 0x00457710.
const APPEAR_END_MILLISECONDS = 501

// 0x00458a80 → 0x00457640 (constructor), 0x004539b0 (placement), 0x004576c0 (kind).
export const createPowerUpBrick = (
  placement: PowerUpBrickPlacement,
  raceModeFlags: number
): PowerUpBrick => {
  const kind = getRaceModeBrickKind(getBrickKindFromCode(placement.kind), raceModeFlags)
  return Object.freeze({
    ...createBrickBase(toVector3(placement.position)),
    identifier: placement.identifier,
    placedKind: kind,
    kind,
    // The constructor writes 3 to +0x5c, +0x60 and +0x64; only the first two are replaced.
    nextKind: BrickKind.TURBO,
    stateAfterCollect: BrickState.HIDDEN,
    respawnDelayMilliseconds: RESPAWN_DELAY_MILLISECONDS,
  })
}

// 0x00457710 (power-up brick vtable slot, called by 0x0045a3f0 every frame).
export const advancePowerUpBrick = (
  arithmetic: FloatArithmetic,
  brick: PowerUpBrick,
  stepMilliseconds: number
): PowerUpBrick => {
  if (brick.state === BrickState.UNUSED) return brick
  const advanced = advanceBrickBase(arithmetic, brick, stepMilliseconds)
  if (advanced.state === BrickState.HIDDEN) {
    if (advanced.timerMilliseconds < advanced.respawnDelayMilliseconds) return advanced
    return Object.freeze({ ...advanced, state: BrickState.APPEARING, timerMilliseconds: 0 })
  }
  if (advanced.state === BrickState.APPEARING) {
    if (advanced.timerMilliseconds < APPEAR_END_MILLISECONDS) return advanced
    return Object.freeze({
      ...advanced,
      state: BrickState.AVAILABLE,
      timerMilliseconds: 0,
      scale: AVAILABLE_BRICK_SCALE,
    })
  }
  if (
    advanced.state !== BrickState.COLLECTED ||
    advanced.timerMilliseconds <= COLLECT_ANIMATION_MILLISECONDS
  ) {
    return advanced
  }
  return Object.freeze({
    ...advanced,
    state: advanced.stateAfterCollect,
    kind: advanced.nextKind,
    timerMilliseconds: 0,
    scale: 0,
  })
}

// 0x00453af0 (slot 0, from the collision registry) and 0x00457820 (slot 1, collect).
export const touchPowerUpBrick = (
  brick: PowerUpBrick,
  racer: RacerPowerUps,
  isRacerWarping: boolean
): PowerUpBrickTouchResult => {
  const touched = getTouchedBrick(brick)
  if (!getIsBrickCollectable(brick, isRacerWarping, racer.heldBrickKind === null)) {
    return Object.freeze({ brick: touched, racer, isCollected: false })
  }
  const previousKind = racer.heldBrickKind
  return Object.freeze({
    brick: Object.freeze({
      ...touched,
      nextKind: previousKind ?? brick.placedKind,
      stateAfterCollect: previousKind === null ? BrickState.HIDDEN : BrickState.APPEARING,
      state: BrickState.COLLECTED,
      timerMilliseconds: 0,
    }),
    racer: getRacerWithBrick(racer, brick.kind),
    isCollected: true,
  })
}
