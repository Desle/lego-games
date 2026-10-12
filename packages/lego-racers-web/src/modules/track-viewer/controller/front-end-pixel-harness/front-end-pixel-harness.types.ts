import type { FrontEndInput } from '@lego-games/lego-racers/front-end'

// A scripted visit to the menus for the browser to run and photograph: the inputs the front end is stepped with after it
// opened (one per step), and the steps whose pixels are read back.
export type FrontEndPixelRequest = {
  // The screen the front end opens on; null is the main menu.
  readonly firstScreenId: number | null
  readonly inputs: readonly (FrontEndInput | null)[]
  readonly frameMilliseconds: number
  // A step count: 0 is the opened front end, n the state after n steps.
  readonly recordSteps: readonly number[]
  readonly width: number
  readonly height: number
}

// The pixels of a recorded step: RGBA bytes, top row first, as base64; and the images and fonts the frame's commands name.
export type FrontEndPixelFrame = {
  readonly step: number
  readonly colorsBase64: string
  readonly imageNames: readonly string[]
  readonly fontNames: readonly string[]
}

export type FrontEndPixelResult = {
  readonly frames: readonly FrontEndPixelFrame[]
}
