import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { Racer } from '../../../racer/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getRacerAfterCheckpointTouch } from '../racer-transitions/racer-transitions.ts'

// 0x00439fc0 (thiscall on the racer: checkpoint, contact record): the side is the contact vector (the touched
// triangle's normal, record +0x24) against the checkpoint plane's normal, `(z + y) + x`; 1 when it is not below 0.
export const getRacerAfterCheckpointContact = (
  arithmetic: FloatArithmetic,
  checkpoints: readonly Checkpoint[],
  racer: Racer,
  checkpointIndex: number,
  direction: Vector3
): Racer => {
  const checkpoint = checkpoints[checkpointIndex]
  if (checkpoint === undefined) return racer
  const { add, multiply, getIsBelow, getIsEqual } = arithmetic
  const [normalX, normalY, normalZ] = checkpoint.plane
  const dot = add(
    add(multiply(direction.z, normalZ), multiply(direction.y, normalY)),
    multiply(direction.x, normalX)
  )
  return getRacerAfterCheckpointTouch(
    racer,
    checkpointIndex,
    getIsEqual(checkpoint.progress, 0),
    getIsBelow(dot, 0) ? 0 : 1
  )
}
