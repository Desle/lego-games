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

// The timed effect (0x00439900) hands 0x00440100 its own milliseconds (the second argument, read back at 0x00439aa1), so the
// tint lasts exactly as long as the curse; the golden trace of the original shows the two counting down together.
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
