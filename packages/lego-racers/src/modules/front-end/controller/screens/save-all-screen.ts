import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { ScreenDefinition, ScreenRuntime } from '../../types/front-end-screen.types.ts'
import { createResult } from '../screen-helpers/screen-helpers.ts'

// `saveall` (0x30): the racer pick puts it on top as it leaves (0x004861b0), and its first update finds no dialog open and
// takes it off again (0x00487020), so it is on top for one frame. The front end pops it (stepFrontEnd); it takes no input.
// Not ported: what it saves and its two draws of that frame (the emulator's front end trace).
export const SAVE_ALL_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.SAVE_ALL,
  getWidgets: () => [],
  handleInput: (runtime: ScreenRuntime) => createResult(runtime),
})
