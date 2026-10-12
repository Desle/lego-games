import { ViewerStatus } from '../../types/viewer-status/viewer-status.ts'
import type { ViewerStatus as ViewerStatusValue } from '../../types/track-viewer.types.ts'
import type { StatusMessageProps } from './status-message.types.ts'

const MESSAGES: Readonly<Record<ViewerStatusValue, string>> = {
  [ViewerStatus.WAITING_FOR_ARCHIVE]: 'Open your LEGO.JAM to list its worlds.',
  [ViewerStatus.READING_ARCHIVE]: 'Reading LEGO.JAM…',
  [ViewerStatus.CHOOSING_WORLD]: 'Choose a world.',
  [ViewerStatus.LOADING_SCENE]: 'Loading the scene…',
  [ViewerStatus.SHOWING_SCENE]: 'Drag to orbit, scroll to zoom, WASD to fly, Q/E down and up.',
  [ViewerStatus.FAILED]: 'Failed',
}

const StatusMessage = ({ status, errorMessage }: StatusMessageProps) => (
  <p role="status" className={status === ViewerStatus.FAILED ? 'text-red-400' : 'text-slate-300'}>
    {MESSAGES[status]}
    {status === ViewerStatus.FAILED && errorMessage !== null && `: ${errorMessage}`}
  </p>
)

export default StatusMessage
