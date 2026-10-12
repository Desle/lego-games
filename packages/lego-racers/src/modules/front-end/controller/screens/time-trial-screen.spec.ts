import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { BestTimeKind, createDefaultProfile, recordBestTime } from '../../../save-data/index.ts'
import type { SaveFile } from '../../../save-data/index.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import type { ScreenRuntime } from '../../types/front-end-screen.types.ts'
import { getCircuitRaceEntries, TIME_TRIAL_SCREEN } from './race-selection-screens.ts'

const isPresent = getIsOriginalJamPresent()
const LAP_MILLISECONDS = 29876
const RACE_MILLISECONDS = 91234

const getTexts = (widgets: readonly FrontEndWidget[]): Readonly<Record<string, string>> =>
  Object.fromEntries(
    widgets.flatMap((widget) =>
      widget.kind === 'text' ? [[widget.itemName, widget.text] as const] : []
    )
  )

describe.skipIf(!isPresent)('the best times of the time trial screen', () => {
  const resources = loadFrontEndResources(openJamArchive(readOriginalJam()))
  const firstRace = getCircuitRaceEntries(resources, 'c0')[0]
  const raceIndex = resources.races.entries.findIndex((entry) => entry.name === firstRace?.name)

  const getRuntime = (saveFile: SaveFile | null, screenMilliseconds: number): ScreenRuntime =>
    ({
      resources,
      environment: { unlockedCircuitMask: 0x7f },
      settings: { saveFile, isVersus: false },
      selection: { circuitIndex: 0, raceIndex: 0, focusIndex: 0 },
      screenMilliseconds,
      racePreview: { cycleCount: 0, cinemaMilliseconds: 0 },
      racePreviewEmitters: null,
      racePreviewEffects: null,
    }) as unknown as ScreenRuntime

  const getSaveFile = (): SaveFile => {
    const lapped = recordBestTime(
      createDefaultProfile(0),
      raceIndex,
      BestTimeKind.LAP,
      LAP_MILLISECONDS,
      'ASH'
    )
    const raced = recordBestTime(
      lapped.profile,
      raceIndex,
      BestTimeKind.RACE,
      RACE_MILLISECONDS,
      'BEN'
    )
    return { profile: raced.profile, racers: [] }
  }

  it('shows the saved best lap with its holder first', () => {
    // Arrange
    const runtime = getRuntime(getSaveFile(), 0)

    // Act
    const texts = getTexts(TIME_TRIAL_SCREEN.getWidgets(runtime))

    // Assert
    expect(texts['besttype']).toBe(resources.getMenuText(0x46))
    expect(texts['bestname']).toBe('ASH')
    expect(texts['besttime']).toBe('0:29:87')
  })

  it('swaps to the best total time after 2,500 ms', () => {
    // Arrange
    const runtime = getRuntime(getSaveFile(), 2500)

    // Act
    const texts = getTexts(TIME_TRIAL_SCREEN.getWidgets(runtime))

    // Assert
    expect(texts['besttype']).toBe(resources.getMenuText(0x47))
    expect(texts['bestname']).toBe('BEN')
    expect(texts['besttime']).toBe('1:31:23')
  })

  it('shows NONE for a race without a saved time', () => {
    // Arrange
    const runtime = getRuntime({ profile: createDefaultProfile(0), racers: [] }, 0)

    // Act
    const texts = getTexts(TIME_TRIAL_SCREEN.getWidgets(runtime))

    // Assert
    expect(texts['bestname']).toBe(resources.getMenuText(0x48))
    expect(texts['besttime']).toBe('')
  })
})
