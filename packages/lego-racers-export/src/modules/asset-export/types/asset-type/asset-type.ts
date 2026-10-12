import { createEnum } from '../../../../shared/types/enum.types.ts'

export const AssetType = createEnum({
  TEXTURE: 'texture',
  SOUND_EFFECT: 'sound_effect',
  MUSIC: 'music',
  VIDEO: 'video',
  VIDEO_FRAME: 'video_frame',
  VIDEO_AUDIO: 'video_audio',
  MODEL: 'model',
  MODEL_BUFFER: 'model_buffer',
  WORLD: 'world',
  WORLD_BUFFER: 'world_buffer',
})
