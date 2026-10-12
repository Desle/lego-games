// The world file a 3D item (MIB 0x42, name `0x2d`) shows. The screens switch the archive's directory before
// loading an item (`FUN_00479c40`/`0x0047bfc0`/`0x0047d230`/`0x00485f70` set `MENUDATA\<set>`), and the engine opens
// `<directory>\<name>.WDB`; the pairs below are the sets those loaders name.
const MENU_WORLD_PATHS: ReadonlyMap<string, string> = new Map([
  // The main menu's platform (screen 2).
  ['tt', 'MENUDATA\\TT.WDB'],
  // The driver's licence camera (screen 0x10).
  ['cam', 'MENUDATA\\CAM.WDB'],
  // Car builder and car editor (screens 0xe and 0x11): `MENUDATA\GARAGE` (0x00477050, 0x0047bfc0).
  ['garage', 'MENUDATA\\GARAGE\\GARAGE.WDB'],
  // The racer showcase of the garage and the racer picks: `MENUDATA\RS_SET` (0x00485f70); its second world holds the
  // blended shadows (see MENU_WORLD_EXTRA_PATHS).
  ['racer', 'MENUDATA\\RS_SET\\RACER.WDB'],
  // The driver editor's platform (screen 0xf): `MENUDATA\CB_SET` (0x0047d230).
  ['cbset', 'MENUDATA\\CB_SET\\CBSET.WDB'],
])

export const getMenuWorldPath = (modelName: string): string | null =>
  MENU_WORLD_PATHS.get(modelName.toLowerCase()) ?? null

// Worlds loaded on top of a menu world, in order (the engine's world list: the second world links to the first one's
// materials). `RS_SET\BLENDED.WDB` has the two skeleton instances `shadow` (under the driver) and `crsdow` (under the car).
const MENU_WORLD_EXTRA_PATHS: ReadonlyMap<string, readonly string[]> = new Map([
  ['racer', ['MENUDATA\\RS_SET\\BLENDED.WDB']],
])

// Every world file of a 3D item, the main one first.
export const getMenuWorldPaths = (modelName: string): readonly string[] | null => {
  const path = getMenuWorldPath(modelName)
  return path === null
    ? null
    : [path, ...(MENU_WORLD_EXTRA_PATHS.get(modelName.toLowerCase()) ?? [])]
}

// The menu worlds whose own camera (`Camera01`: position, forward, up, near plane, far plane and vertical field of view,
// world keywords 0x45 to 0x47) the original draws with: the projection matrices of its draws of the main menu (`tt`), the
// racer showcase (`racer`) and the cinemas (their worlds carry the camera `Camera01`; see `getCinemaWorldPaths` in the viewer) have exactly that eye and field of view, and not the nine floats
// of the MIB item. The other worlds are open (hypothesis: the same). The 3D area of a framed viewport is the item's
// rectangle inset by the frame's thickness (the racer showcase: 16 pixels, measured; the main menu's has none).
const WORLD_CAMERA_INSETS: ReadonlyMap<string, number> = new Map([
  ['tt', 0],
  ['racer', 16],
])

export const getWorldCameraInset = (modelName: string): number | null =>
  WORLD_CAMERA_INSETS.get(modelName.toLowerCase()) ?? null
