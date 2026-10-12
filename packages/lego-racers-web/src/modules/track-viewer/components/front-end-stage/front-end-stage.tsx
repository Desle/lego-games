import type { FrontEndStageProps } from './front-end-stage.types.ts'

// The menus' 640 × 480 surface, scaled to the stage without smoothing (the game's menus are pixel art).
export const MENU_WIDTH = 640
export const MENU_HEIGHT = 480

const FrontEndStage = ({ canvasReference, errorMessage, width, height }: FrontEndStageProps) => (
  <div className="relative" style={{ width, height }} data-testid="front-end-stage">
    <canvas
      ref={canvasReference}
      className="absolute inset-0"
      width={MENU_WIDTH}
      height={MENU_HEIGHT}
      style={{ width, height, imageRendering: 'pixelated' }}
      aria-label="LEGO Racers menus"
    />
    {errorMessage !== null && (
      <p role="alert" className="absolute inset-x-0 top-2 text-center text-sm text-red-400">
        {errorMessage}
      </p>
    )}
  </div>
)

export default FrontEndStage
