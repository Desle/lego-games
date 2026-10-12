import { emitPictureCreated } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type {
  PictureState,
  ReplaceablePicture,
  ReplaceablePictureOriginal,
} from './replaceable-picture.types.ts'

// A 2D picture of the archive that an extension may replace by a bigger one (drawn from the original's pixels until it does).
// `onReplaced` runs after each replacement with the new state.
export const createReplaceablePicture = (
  archivePath: string,
  original: ReplaceablePictureOriginal,
  onReplaced: (state: PictureState) => void
): ReplaceablePicture => {
  let state: PictureState = Object.freeze({
    name: original.name,
    width: original.width,
    height: original.height,
    colors: original.colors,
    sourceScale: 1,
  })
  emitPictureCreated({
    archivePath,
    originalPixels: original,
    replacePixels: (pixels) => {
      state = Object.freeze({
        name: original.name,
        width: pixels.width,
        height: pixels.height,
        colors: pixels.colors,
        sourceScale: pixels.width / original.width,
      })
      onReplaced(state)
    },
  })
  return Object.freeze({ getState: () => state })
}
