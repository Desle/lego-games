import type { Cinema } from '../../types/cinema.types.ts'
import type { CinemaClock, CinemaSkipInput } from './cinema-clock.types.ts'

const MILLISECONDS_PER_SECOND = 1000 // the division by 1000 at 0x004063af (multiply by 0x10624dd3, shift by 6)
const DEVICE_CLASS_MASK = 0xf0000000 // AND at 0x00466ef0
// The device classes whose presses skip a cinema: the compares at 0x00466ef6, 0x00466efe and 0x00466f06.
const SKIPPING_DEVICE_CLASSES: readonly number[] = [0x10000000, 0x20000000, 0x30000000]
// A keyboard press (class 1, the compare at 0x00466ef6); the menus' inputs are all of this class.
export const KEYBOARD_EVENT_CLASS = 0x10000000 // 0x00466ef6

export const CINEMA_CLOCK_START: CinemaClock = Object.freeze({
  frame: 0,
  frameMilliseconds: 0,
  isAtEnd: false,
})

// 0x00406390 for a cinema that does not loop (flag 2 clear) and plays at its own rate (+0x54 = +0x58): the summed
// frame-milliseconds give the frame; a frame at or past the length sets the end flag and stops the clock, keeping the last
// frame and sum.
export const stepCinemaClock = (
  clock: CinemaClock,
  cinema: Cinema,
  milliseconds: number
): CinemaClock => {
  if (clock.isAtEnd) return clock
  const frameMilliseconds = (cinema.framesPerSecond * milliseconds + clock.frameMilliseconds) >>> 0
  const frame = Math.floor(frameMilliseconds / MILLISECONDS_PER_SECOND)
  return frame < cinema.lengthFrames
    ? Object.freeze({ frame, frameMilliseconds, isAtEnd: false })
    : Object.freeze({ ...clock, isAtEnd: true })
}

// The clock after a cinema has played this long from its start: one step of the summed milliseconds lands where any
// sequence of steps adding up to them does (the sum is what the frame comes from).
export const getCinemaClock = (cinema: Cinema, milliseconds: number): CinemaClock =>
  stepCinemaClock(CINEMA_CLOCK_START, cinema, milliseconds)

// Cinema_Update 0x00466d90: the update that finds the end flag set marks the cinema finished (a file of one cinema, or the
// last of a file played through), and the screen takes its way out in the same frame (0x00479a10). `milliseconds` is the
// clock before that update.
export const getIsCinemaFinished = (cinema: Cinema, milliseconds: number): boolean =>
  getCinemaClock(cinema, milliseconds).isAtEnd

// 0x00466ec0, the cinema widget's key handler: a press (not a repeat) of a keyboard, mouse or joystick ends a skippable
// cinema once its frame has reached the record's rate (+0x58: one second in), or at once without a record.
export const getIsCinemaSkipped = (input: CinemaSkipInput): boolean =>
  (input.frame === null || input.framesPerSecond <= input.frame) &&
  input.isSkippable &&
  !input.isRepeated &&
  SKIPPING_DEVICE_CLASSES.includes((input.eventCode & DEVICE_CLASS_MASK) >>> 0)

// A keyboard press reaching the widget of a cinema that has played `milliseconds`.
export const getIsCinemaSkippedByKey = (cinema: Cinema, milliseconds: number): boolean =>
  getIsCinemaSkipped({
    frame: getCinemaClock(cinema, milliseconds).frame,
    framesPerSecond: cinema.framesPerSecond,
    isSkippable: true,
    eventCode: KEYBOARD_EVENT_CLASS,
    isRepeated: false,
  })
