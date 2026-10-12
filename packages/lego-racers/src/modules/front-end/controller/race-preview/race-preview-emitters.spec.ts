import { openJamArchive } from '../../../jam-archive/index.ts'
import { loadRandomTable } from '../../../random-table/index.ts'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import { advanceRacePreviewEmitters } from './race-preview-emitters.ts'

const FRAME_MILLISECONDS = 33

describe.skipIf(!(getIsOriginalJamPresent() && getIsOriginalExecutablePresent()))(
  'advanceRacePreviewEmitters',
  () => {
    const getFiles = () => ({
      resources: loadFrontEndResources(openJamArchive(readOriginalJam())).getRacePreview(),
      randomTable: loadRandomTable(readOriginalExecutable()),
    })

    it('starts the two snow emitters of the ice world and draws from the random table', () => {
      // Arrange
      const { resources, randomTable } = getFiles()
      const input = {
        previous: null,
        resources,
        cinema: resources.cinemas.cinemas.find((cinema) => cinema.name === 'space2') ?? null,
        previousMilliseconds: 0,
        milliseconds: FRAME_MILLISECONDS,
        frameMilliseconds: FRAME_MILLISECONDS,
        isRestarted: true,
        random: { table: randomTable, position: 0 },
      }

      // Act
      const step = advanceRacePreviewEmitters(input)

      // Assert
      expect(step.emitters?.started).toHaveLength(2)
      expect(
        step.emitters?.pool.instances.filter((instance) => instance.system.isActive)
      ).toHaveLength(2)
      expect(step.randomPosition).toBeGreaterThan(0)
    })

    it('has no emitters in a cinema without a snow dummy, and none on a screen without a preview', () => {
      // Arrange
      const { resources, randomTable } = getFiles()
      const input = {
        previous: null,
        resources,
        cinema: resources.cinemas.cinemas.find((cinema) => cinema.name === 'castle1') ?? null,
        previousMilliseconds: 0,
        milliseconds: FRAME_MILLISECONDS,
        frameMilliseconds: FRAME_MILLISECONDS,
        isRestarted: true,
        random: { table: randomTable, position: 0 },
      }

      // Act
      const castleStep = advanceRacePreviewEmitters(input)
      const noPreviewStep = advanceRacePreviewEmitters({ ...input, cinema: null })

      // Assert
      expect(castleStep.emitters?.started).toHaveLength(0)
      expect(castleStep.randomPosition).toBe(0)
      expect(noPreviewStep.emitters).toBeNull()
    })
  }
)
