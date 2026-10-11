import type { FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import { createResult, getPageWidgets, MenuSound } from '../screen-helpers/screen-helpers.ts'

const ROW_LEFT = 160
const ROW_RIGHT = 480
const FIRST_ROW_TOP = 150
const ROW_HEIGHT = 36
const PLAYER_COLOR = 0xff00ff00
const OTHER_COLOR = 0xffffffff
const ROW_STYLE = 'banner'

// The screens a circuit ends on (settings +0x1c = 0x16..0x19, CircuitRunner_PlayCircuit 0x0041ed80): the page of the
// description (its award cinema is not ported) and the final standings the points record holds. Any key leaves for
// the main menu, where the front end starts after a session.
const getWidgets = (runtime: ScreenRuntime, screenId: number): readonly FrontEndWidget[] => [
  ...getPageWidgets(runtime, screenId),
  ...runtime.environment.standingRows.map((row, index): FrontEndWidget => ({
    kind: 'placed_text',
    text: `${String(row.rank + 1)}. ${row.racerName.toUpperCase()}  ${String(row.points)}`,
    styleName: ROW_STYLE,
    rectangle: {
      left: ROW_LEFT,
      top: FIRST_ROW_TOP + index * ROW_HEIGHT,
      right: ROW_RIGHT,
      bottom: FIRST_ROW_TOP + (index + 1) * ROW_HEIGHT,
    },
    alignment: 'left',
    color: row.isPlayer ? PLAYER_COLOR : OTHER_COLOR,
  })),
]

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult =>
  input === 'accept' || input === 'back'
    ? createResult(runtime, {
        navigation: { kind: 'push', screenId: FrontEndScreen.MAIN_MENU },
        soundNames: [MenuSound.ACCEPT],
      })
    : createResult(runtime)

export const createCircuitResultScreen = (screenId: number): ScreenDefinition =>
  Object.freeze({
    screenId,
    getWidgets: (runtime: ScreenRuntime) => getWidgets(runtime, screenId),
    handleInput,
  })
