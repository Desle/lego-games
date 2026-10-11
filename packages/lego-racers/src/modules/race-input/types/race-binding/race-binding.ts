import { createEnum } from '../../../../shared/types/enum.types.ts'

// The player controller's nine bindings, in the order Race_AcquireControllers 0x004343e0 hands them to 0x004308f0
// and 0x004309c0 switches on them. The names describe the handler each calls (racer.md).
export const RaceBinding = createEnum({
  STEER_POSITIVE: 'steer_positive',
  STEER_NEGATIVE: 'steer_negative',
  ACCELERATE: 'accelerate',
  BRAKE: 'brake',
  USE_POWER_UP: 'use_power_up',
  CHANGE_CAMERA: 'change_camera',
  CHANGE_HUD_MODE: 'change_hud_mode',
  POWER_SLIDE: 'power_slide',
  LOOK_BEHIND: 'look_behind',
})
