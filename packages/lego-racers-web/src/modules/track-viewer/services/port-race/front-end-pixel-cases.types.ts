import type { FrontEndInput } from '@lego-games/lego-racers/front-end'

// A key tapped in an original frame: the port's input and the scan code the emulator presses.
export type FrontEndKey = {
  readonly frame: number
  readonly input: FrontEndInput
  readonly scanCode: number
}

// A visit to the menus whose pixels are compared. The original opens its main menu in frame 154; a pushed screen is put on
// the screen stack in frame 200 (the harness of the emulator). The port's front end is created for that frame and stepped
// with the keys, one step per original frame after it.
export type FrontEndPixelCase = {
  readonly name: string
  readonly keys: readonly FrontEndKey[]
  // A screen the keys cannot reach, pushed on the screen stack (the cinemas of the awards and introductions); null for none.
  readonly pushedScreenId: number | null
  readonly recordFrames: readonly number[]
  // The largest share of differing pixels on the worst recorded frame.
  readonly maximumDifferingShare: number
}
