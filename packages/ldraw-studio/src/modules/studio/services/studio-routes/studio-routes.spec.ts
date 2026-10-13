import { LDrawFileName, getLDrawFileRoutePaths } from '../../../files/index.ts'
import {
  MODEL_FILES_FILE,
  STUDIO_LIBRARY_URL,
  STUDIO_MODELS_URL,
  STUDIO_ROUTE_PREFIX,
} from './studio-routes.constants.ts'

describe('studio routes', () => {
  it('are the routes the dev server mounts', () => {
    // Arrange
    const served = getLDrawFileRoutePaths(STUDIO_ROUTE_PREFIX)

    // Act
    const fetched = {
      library: STUDIO_LIBRARY_URL,
      models: STUDIO_MODELS_URL,
      files: MODEL_FILES_FILE,
    }

    // Assert
    expect(fetched).toEqual({
      library: served.LIBRARY,
      models: served.MODELS,
      files: LDrawFileName.MODEL_FILES,
    })
  })
})
