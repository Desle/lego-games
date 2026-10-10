import { createEnum } from '../../../../shared/types/enum.types.ts'
import {
  getStepWithAttachmentSlot,
  getStepWithAttachmentSlotFreed,
} from '../../../power-ups/index.ts'
import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { DebrisAnimations, DebrisChange, DebrisPiece, DebrisPool } from './debris.types.ts'

// Piece +0x10.
export const DebrisState = createEnum({
  // 1: free.
  IDLE: 'idle',
  // 2: playing its animation on an attachment slot.
  PLAYING: 'playing',
  // 3: the animation is over; the slot is freed in the same update.
  FINISHED: 'finished',
})

// 0x0045bd..: five pieces, four models.
const PIECE_COUNT = 5
const MODEL_COUNT = 4

const IDLE_PIECE: DebrisPiece = Object.freeze({
  state: DebrisState.IDLE,
  slotIndex: null,
  elapsedMilliseconds: 0,
  durationMilliseconds: 0,
})

export const createDebrisPool = (): DebrisPool =>
  Object.freeze({
    pieces: Object.freeze(Array.from({ length: PIECE_COUNT }, () => IDLE_PIECE)),
    nextModel: 0,
    thrownCount: 0,
  })

const getPoolWithPiece = (pool: DebrisPool, index: number, piece: DebrisPiece): DebrisPool =>
  Object.freeze({
    ...pool,
    pieces: Object.freeze(
      pool.pieces.map((current, currentIndex) => (currentIndex === index ? piece : current))
    ),
  })

// 0x004517c0 (one piece of 0x0045b550): the first piece that is not playing takes the next attachment slot and the
// next model; with every piece playing, or no slot free, nothing happens.
export const getThrownDebris = (
  step: PowerUpStep,
  pool: DebrisPool,
  animations: DebrisAnimations
): DebrisChange => {
  const index = pool.pieces.findIndex((piece) => piece.state !== DebrisState.PLAYING)
  if (index === -1) return { step, pool }
  const allocation = getStepWithAttachmentSlot(step)
  if (allocation.slotIndex === null) return { step: allocation.step, pool }
  const modelAnimations = animations[pool.nextModel] ?? []
  const durationMilliseconds =
    modelAnimations[
      pool.thrownCount % (modelAnimations.length === 0 ? 1 : modelAnimations.length)
    ] ?? 0
  return {
    step: allocation.step,
    pool: Object.freeze({
      ...getPoolWithPiece(pool, index, {
        state: DebrisState.PLAYING,
        slotIndex: allocation.slotIndex,
        elapsedMilliseconds: 0,
        durationMilliseconds,
      }),
      nextModel: (pool.nextModel + 1) % MODEL_COUNT,
      thrownCount: pool.thrownCount + 1,
    }),
  }
}

// 0x00451860 (thiscall: milliseconds): every playing piece advances its animation; one that ends frees its slot.
export const getUpdatedDebris = (
  step: PowerUpStep,
  pool: DebrisPool,
  stepMilliseconds: number
): DebrisChange =>
  pool.pieces.reduce<DebrisChange>(
    (current, piece, index) => {
      if (piece.state !== DebrisState.PLAYING) return current
      const elapsedMilliseconds = piece.elapsedMilliseconds + stepMilliseconds
      if (elapsedMilliseconds < piece.durationMilliseconds) {
        return {
          step: current.step,
          pool: getPoolWithPiece(current.pool, index, { ...piece, elapsedMilliseconds }),
        }
      }
      return {
        step:
          piece.slotIndex === null
            ? current.step
            : getStepWithAttachmentSlotFreed(current.step, piece.slotIndex),
        pool: getPoolWithPiece(current.pool, index, IDLE_PIECE),
      }
    },
    { step, pool }
  )
