import FrontEndStage from '../../components/front-end-stage/front-end-stage.tsx'
import { useFrontEndController } from '../../controller/front-end-controller/front-end-controller.ts'
import type { FrontEndViewProps } from './front-end-view.types.ts'

// The menus of the game over the stage: they choose the race and the racers, then the race starts.
const FrontEndView = ({
  jam,
  randomTable,
  memory,
  readTune,
  width,
  height,
  firstScreenId,
  standingRows,
  onMenuMemoryChanged,
  onRaceRequested,
  onDemonstrationRequested,
  onQuit,
}: FrontEndViewProps) => {
  const frontEnd = useFrontEndController({
    jam,
    randomTable,
    memory,
    readTune,
    firstScreenId,
    standingRows,
    onMenuMemoryChanged,
    onRaceRequested,
    onDemonstrationRequested,
    onQuit,
  })
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
