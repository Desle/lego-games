import type { LoadRaceOptions } from '@lego-games/lego-racers/race'
import FrontEndStage from '../../components/front-end-stage/front-end-stage.tsx'
import { useFrontEndController } from '../../controller/front-end-controller/front-end-controller.ts'

type FrontEndViewProps = {
  readonly jam: Uint8Array
  readonly width: number
  readonly height: number
  readonly onRaceRequested: (options: LoadRaceOptions) => void
  readonly onQuit: () => void
}

// The menus of the game over the stage: they choose the race and the racers, then the race starts.
const FrontEndView = ({ jam, width, height, onRaceRequested, onQuit }: FrontEndViewProps) => {
  const frontEnd = useFrontEndController({ jam, onRaceRequested, onQuit })
  return (
    <FrontEndStage
      canvasReference={frontEnd.canvasReference}
      errorMessage={frontEnd.errorMessage}
      width={width}
      height={height}
    />
  )
}

export default FrontEndView
