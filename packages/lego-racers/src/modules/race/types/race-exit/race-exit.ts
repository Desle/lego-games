import { createEnum } from '../../../../shared/types/enum.types.ts'

// Why Race_RunLoop 0x00432540 left its loop (race +0x3334 became 0), as the front end and the circuit flow read it from
// the game settings' flag byte (+0x1e).
export const RaceExit = createEnum({
  // The loop still runs.
  NONE: 'none',
  // Race_UpdateState5 0x00435180 ended the results: placements and the points record are final.
  FINISHED: 'finished',
  // The pause menu's confirmed quit: settings +0x1e |= 0x8 (0x00436160, menu state 3, pending action 2).
  QUIT: 'quit',
  // The pause menu's confirmed restart. Inside a circuit (a points record, settings +0x1e & 0x40 clear) the original
  // sets settings +0x1e |= 0x20 and leaves the loop; otherwise it restarts in place (0x004362e0). The port leaves the
  // loop in both cases and the caller starts the race again (**hypothesis**: the in-place restart is the same race).
  RESTART: 'restart',
  // The ghost result menu's other choice: the loop ends without a flag (0x00436160, menu state 2).
  LEFT: 'left',
  // A key pressed during a demonstration: settings +0x1e |= 0x80 (0x00435c00).
  DEMONSTRATION_INTERRUPTED: 'demonstration_interrupted',
})
