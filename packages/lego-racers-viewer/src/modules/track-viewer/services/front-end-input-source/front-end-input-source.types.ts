import type { FrontEndInput } from '@lego-games/lego-racers/front-end'

export type FrontEndInputSource = {
  // The inputs pressed since the last read, oldest first (a held key repeats as the keyboard does).
  readonly read: () => readonly FrontEndInput[]
  // The gamepads connected (the menus' "controller count": the versus race needs one).
  readonly getControllerCount: () => number
  readonly dispose: () => void
}
