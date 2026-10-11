import type { FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { createResult, MenuSound } from '../screen-helpers/screen-helpers.ts'

// A screen this port does not run (the garage, the car builder, the award cinemas, the controls, the credits ...):
// its backdrop when the description has one and its name, with a way back.
export const createStaticScreen = (screenId: number): ScreenDefinition =>
  Object.freeze({
    screenId,
    getWidgets: (runtime: ScreenRuntime): readonly FrontEndWidget[] => [
      { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
      {
        kind: 'text',
        itemName: 'banner',
        text: (runtime.resources.menuNames[screenId] ?? '').toUpperCase(),
        styleName: 'banner',
        alignment: 'left',
      },
    ],
    handleInput: (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult =>
      input === 'accept' || input === 'back'
        ? createResult(runtime, { navigation: { kind: 'pop' }, soundNames: [MenuSound.BACK] })
        : createResult(runtime),
  })
