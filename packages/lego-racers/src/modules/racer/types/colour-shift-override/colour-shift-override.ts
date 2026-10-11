import type { ColourShift, Racer } from '../racer.types.ts'

// What the timed effect's hand-over (0x00439900) asks of 0x00440100: shifts 1, 0, 1, 0 and biases 0, 0x40, 0, 0.
export const TIMED_EFFECT_COLOUR_SHIFT: ColourShift = {
  shifts: [1, 0, 1, 0],
  biases: [0, 0x40, 0, 0],
}

// What the wand (0x00455440) asks of 0x00440100 for 100 ms: no shift and biases 225, 225, 255, 0 (a flash).
export const WAND_COLOUR_SHIFT: ColourShift = {
  shifts: [0, 0, 0, 0],
  biases: [0xe1, 0xe1, 0xff, 0],
}
export const WAND_COLOUR_SHIFT_MILLISECONDS = 100

// 0x00439900 passes the giver figure's +0x84 as the milliseconds of 0x00440100. The figure it is given is either the
// power-up effect's (0x00452da0 with 10000 ms; built by 0x00452550 from the player's figure, whose +0xa8 is the address
// racer + 0x40 that 0x0043b785 stored there) or the holder's own copy (racer +0x29c). Both are built by
// 0x0040d550 (this, model, material, +0xa8, +0x84), and 0x00439900 stores the giver's +0xa8 into the copy's +0x84 and 0
// into its +0xa8. So the effect figure's +0x84 is that heap address (as an integer of milliseconds), and every copy's is 0.
// Racers sit at 0x50xxxxxx in the original's heap (traced), so the address is about 1.3 billion milliseconds: the first
// holder keeps the tint until the effect ends. A second hand-over passes 0 and its tint ends at the next update.
export const POWER_UP_EFFECT_FIGURE_DISTANCE = 0x50000000
export const COPIED_FIGURE_DISTANCE = 0

// 0x00440100 (vehicle, shift, milliseconds): vehicle +0x3c4 = 1, +0x3c8 = the milliseconds, and the models take the
// shift at once. The vehicle does not keep the shift (it is not copied to +0x3a0).
export const getRacerWithColourShiftOverride = (
  racer: Racer,
  shift: ColourShift,
  milliseconds: number
): Racer =>
  Object.freeze({
    ...racer,
    isColourShiftOverridden: true,
    colourShiftOverrideMilliseconds: milliseconds >>> 0,
    overridingColourShift: shift,
  })

// 0x00440130 (fastcall): +0x3c4 and +0x3c8 are cleared; the models take the track's shift again when it is enabled
// (+0x3c0), else their own colours.
export const clearColourShiftOverride = (racer: Racer): Racer =>
  Object.freeze({
    ...racer,
    isColourShiftOverridden: false,
    colourShiftOverrideMilliseconds: 0,
  })

// Vehicle_Update 0x0043e070 after the display figure's update: while the override runs, a step that reaches the
// milliseconds left (unsigned) clears it, a shorter one counts them down.
export const stepColourShiftOverride = (racer: Racer, stepMilliseconds: number): Racer => {
  if (!racer.isColourShiftOverridden) return racer
  return stepMilliseconds >>> 0 < racer.colourShiftOverrideMilliseconds
    ? Object.freeze({
        ...racer,
        colourShiftOverrideMilliseconds: racer.colourShiftOverrideMilliseconds - stepMilliseconds,
      })
    : clearColourShiftOverride(racer)
}

// What the vehicle's models show: while 0x00440100's override lasts, 0x004400a0 and 0x004400e0 change only the
// stored track shift (+0x3a0..+0x3c0), not the models.
export const getDisplayedColourShift = (racer: Racer): ColourShift | null =>
  racer.isColourShiftOverridden ? racer.overridingColourShift : racer.colourShift
