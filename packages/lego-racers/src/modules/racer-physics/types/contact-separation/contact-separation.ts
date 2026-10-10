import type { CollisionObject } from '../../../collision/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { saveStepStart } from '../car-rigid-body/car-rigid-body.ts'
import { advanceToContact } from '../hull-contacts/hull-contacts.ts'
import { CAR_RIGID_BODY_HOOKS, clearContacts } from '../rigid-body-step/rigid-body-step.ts'
import type { CarRigidBody, CarRigidBodyHooks } from '../racer-physics.types.ts'

// 0x004490b0 (thiscall: displacement): moves the display frame and the body's frame by the
// displacement (each component stored), then tests the hull against the world (0x004478b0 with a
// zero step, the track unless flag 0x1000). When a hull point ends inside the world the body goes
// back to where the display frame was. The world centre of mass is not refreshed.
export const moveOutOfContact = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  displacement: Vector3,
  collisionObjects: readonly CollisionObject[],
  hooks: CarRigidBodyHooks = CAR_RIGID_BODY_HOOKS
): CarRigidBody => {
  const { add, storeFloat } = arithmetic
  const saved = saveStepStart(clearContacts(body))
  const origin = saved.displayFrame.position
  const moved = Object.freeze({
    x: storeFloat(add(origin.x, displacement.x)),
    y: storeFloat(add(origin.y, displacement.y)),
    z: storeFloat(add(origin.z, displacement.z)),
  })
  const shifted: CarRigidBody = Object.freeze({
    ...saved,
    displayFrame: Object.freeze({ ...saved.displayFrame, position: moved }),
    frame: Object.freeze({ ...saved.frame, position: moved }),
  })
  const advanced = advanceToContact(arithmetic, shifted, 0, collisionObjects, hooks).body
  if (advanced.contactCount === 0) return advanced
  return Object.freeze({
    ...advanced,
    displayFrame: Object.freeze({ ...advanced.displayFrame, position: origin }),
    frame: Object.freeze({ ...advanced.frame, position: origin }),
  })
}
