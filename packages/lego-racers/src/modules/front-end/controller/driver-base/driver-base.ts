import { getDriverPartBytes } from '../../../car-builder/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import { createDriverSession } from '../../../figure-builder/index.ts'
import type { DriverSession } from '../../../figure-builder/index.ts'
import { getIsPartUnlocked } from '../../../save-data/index.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  FrontEndEnvironment,
  FrontEndResources,
  FrontEndSettings,
} from '../../types/front-end.types.ts'

// The car and driver the menus are working on: the one the player made in this session, else the first racer of
// `DEFAULT.LRS` (the racer a player without a save drives).
export const getBaseCar = (settings: FrontEndSettings, resources: FrontEndResources): SavedCar =>
  settings.playerCar ?? resources.getDefaultCar()

// 0x0047d0d0 and 0x00483c60: the driver editor opens with the racer's own parts, offering the ones the save has earned
// (a new profile earns the free ones; without a save the front end's `isEveryPartUnlocked` hook decides).
export const getDriverForScreen = (
  screenId: number,
  settings: FrontEndSettings,
  resources: FrontEndResources,
  environment: FrontEndEnvironment
): DriverSession | null => {
  if (screenId !== FrontEndScreen.EDIT_DRIVER) return null
  // With a save the profile says which parts were earned (0x00483c60); without one the front end's hook says.
  const profile = settings.saveFile?.profile ?? null
  return createDriverSession(
    resources.getDriverCatalog(),
    getDriverPartBytes(getBaseCar(settings, resources).record),
    (requirement) =>
      profile === null ? environment.isEveryPartUnlocked : getIsPartUnlocked(profile, requirement)
  )
}
