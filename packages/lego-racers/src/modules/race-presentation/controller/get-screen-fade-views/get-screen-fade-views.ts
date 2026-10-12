import { getScreenFadeAlpha } from '../../../race/index.ts'
import type { RaceState } from '../../../race/index.ts'
import type { ScreenFadeView, WarpView } from '../../types/race-presentation.types.ts'

// 0x0045d940 draws the fader once inside the warp's tunnel scene and Race_Render 0x004354d0 (0x004357e0) once more at
// the end of the frame.
const WARP_DRAW_COUNT = 2
const PLAIN_DRAW_COUNT = 1

// The fades of the race's fader that cover the local player's view (0x00494fa0 draws every entry in use; an entry of
// another player's view or of no view is not this one).
export const getScreenFadeViews = (
  raceState: RaceState,
  playerIndex: number,
  warpView: WarpView | null
): readonly ScreenFadeView[] =>
  Object.freeze(
    raceState.screenFader
      .filter(
        (fade) => fade.isActive && (fade.playerIndex === null || fade.playerIndex === playerIndex)
      )
      .map((fade) =>
        Object.freeze({
          red: fade.red,
          green: fade.green,
          blue: fade.blue,
          alpha: getScreenFadeAlpha(fade),
          drawCount: warpView === null ? PLAIN_DRAW_COUNT : WARP_DRAW_COUNT,
        })
      )
  )
