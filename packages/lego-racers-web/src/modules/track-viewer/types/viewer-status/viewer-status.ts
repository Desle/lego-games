import { createEnum } from '../../../../shared/types/enum.types.ts'

export const ViewerStatus = createEnum({
  WAITING_FOR_ARCHIVE: 'waiting_for_archive',
  READING_ARCHIVE: 'reading_archive',
  CHOOSING_WORLD: 'choosing_world',
  LOADING_SCENE: 'loading_scene',
  SHOWING_SCENE: 'showing_scene',
  FAILED: 'failed',
})
