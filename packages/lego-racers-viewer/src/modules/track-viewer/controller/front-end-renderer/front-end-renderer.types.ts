import type { FrontEndDrawCommand } from '@lego-games/lego-racers/front-end'

export type FrontEndRenderer = {
  // Draws one frame of draw commands over the whole surface (the commands start with the backdrop).
  readonly draw: (commands: readonly FrontEndDrawCommand[]) => void
}
