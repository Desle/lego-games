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
  // The racer showcase of the garage and the racer picks: `MENUDATA\RS_SET` (0x00485f70).
  ['racer', 'MENUDATA\\RS_SET\\RACER.WDB'],
  // The driver editor's platform (screen 0xf): `MENUDATA\CB_SET` (0x0047d230).
  ['cbset', 'MENUDATA\\CB_SET\\CBSET.WDB'],
])

export const getMenuWorldPath = (modelName: string): string | null =>
  MENU_WORLD_PATHS.get(modelName.toLowerCase()) ?? null
