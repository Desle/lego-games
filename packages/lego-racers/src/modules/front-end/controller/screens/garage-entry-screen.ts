import type { FrontEndInput } from '../../types/front-end.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { createResult, getPageWidgets, MenuSound } from '../screen-helpers/screen-helpers.ts'

// The garage (screen 3, `GARAGE.MIB`: new racer, edit racer, copy, delete, the racer showcase) is not ported yet. Until it
// is, the build button of the main menu opens its page, and accept goes on to the car builder it leads to (the garage's
// "new racer" and "edit car" end there, 0x00474750 target 0x11 on the way out). **Interim**, not the original's flow.
const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  if (input === 'accept') {
    return createResult(runtime, {
      navigation: { kind: 'push', screenId: FrontEndScreen.CAR_BUILD },
      soundNames: [MenuSound.ACCEPT],
    })
  }
  return input === 'back'
    ? createResult(runtime, { navigation: { kind: 'pop' }, soundNames: [MenuSound.BACK] })
    : createResult(runtime)
}

export const GARAGE_ENTRY_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.GARAGE,
  getWidgets: (runtime: ScreenRuntime) => getPageWidgets(runtime, FrontEndScreen.GARAGE),
  handleInput,
})
