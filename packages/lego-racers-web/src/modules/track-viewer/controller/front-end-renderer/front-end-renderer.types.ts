import type { FrontEndDrawCommand } from '@lego-games/lego-racers/front-end'

export type FrontEndRenderer = {
  // Draws one frame of draw commands over the whole surface (the commands start with the backdrop).
  // `deltaMilliseconds` replaces the wall clock for the animation of the 3D items (the pixel trace's scripted time).
  readonly draw: (commands: readonly FrontEndDrawCommand[], deltaMilliseconds?: number) => void
  readonly dispose: () => void
}
