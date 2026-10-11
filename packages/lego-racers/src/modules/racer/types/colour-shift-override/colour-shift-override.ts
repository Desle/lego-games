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

// 0x00439900 passes the giver figure's +0x84 as the milliseconds. That field holds the figure's first level distance
// (the float 250000.0, 0x48742400, for a figure 0x0043b785 built) or, for a copy of one, the copied figure's +0xa8
// (a heap address or 0): a quirk the original never explains. Every non-zero value is far beyond a race, so the
// override then only ends with the timed effect (0x00439b00); the port uses the float's bits.
export const TIMED_EFFECT_COLOUR_SHIFT_MILLISECONDS = 0x48742400

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
