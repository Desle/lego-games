import { createEnum } from '../../../../shared/types/enum.types.ts'

// Camera +0x02, set by 0x004283d0 from the preset's mode byte (and to 0 by Race_LoadTrackContent for the introduction).
export const CameraMode = createEnum({
  // 0: the introduction flies from the race description's camera point to the racer (not ported).
  INTRODUCTION: 'introduction',
  // 1: the chase camera.
  CHASE: 'chase',
  // 2: the view from the car.
  COCKPIT: 'cockpit',
  // 3: the finish camera: the chase camera easing from the old preset over 2,000 ms.
  FINISH: 'finish',
})
