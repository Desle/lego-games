// Keywords of Cinema_Load (LEGORacers.exe 0x00406980, 0x00406cb0, 0x00406b90, 0x00405950) and of its entry readers
// (0x004050a0, 0x00404a10, 0x00405630, 0x00405280, 0x00407090).
export const CinemaKeyword = Object.freeze({
  // Top level: the cinemas of the file, and the names of the worlds they use.
  CINEMAS: 0x27,
  WORLD_NAMES: 0x28,
  // A cinema's sections (each an array of entries, entry keyword = section keyword).
  OBJECT_SECTION: 0x29, // 0x34-byte entries: the camera object the cinema looks through
  ACTION_SECTION: 0x2e, // 0x68-byte entries: instances shown, placed and animated
  COLOUR_SECTION: 0x35, // 0x38-byte entries: the ambient light
  DUMMY_SECTION: 0x37, // 0x44-byte entries: dummy objects (flashes, emitters)
  LIGHT_SECTION: 0x3a, // 0x44-byte entries: directional lights
  LENGTH: 0x2c, // cinema +0x4c: its length in frames (the longest entry end when absent)
  FRAMES_PER_SECOND: 0x3b, // cinema +0x54 and +0x58
  // Entry keywords.
  TARGET: 0x2a, // object entry +0x24: name of the world camera
  START: 0x2b, // +0x0c: first frame
  DURATION: 0x2c, // frames; the end (+0x10) is START + DURATION
  FLAG: 0x2d, // object entry +0x30, action entry +0x58
  MESH_INSTANCE_NAME: 0x2f, // action kind 1 (+0x2c, eight characters)
  SKELETON_INSTANCE_NAME: 0x30, // action kind 2
  THIRD_INSTANCE_NAME: 0x31, // action kind 3
  INTEGER_PAIR: 0x32, // action kind 4 (+0x2c, +0x30)
  POSITION: 0x33, // three floats
  ORIENTATION: 0x34, // six floats
  KEYS: 0x36, // action: array of records of five integers
  COLOUR: 0x38, // three integers
  DIRECTION: 0x39, // three floats
  INTEGER_PAIR_OF_LIGHT: 0x3c,
})
