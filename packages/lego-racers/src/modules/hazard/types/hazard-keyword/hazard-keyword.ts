// Hazard keywords of Hazards_Load (LEGORacers.exe 0x0048a4d0). Each creates an object whose vtable slot +0x10
// reads the rest; the models a class looks up are noted as hints, not names.
export const HazardKeyword = Object.freeze({
  HAZARDS: 0x27,
  HAZARD_28: 0x28, // 0x0048b920, "piltop"/"pilcol", reads nothing
  HAZARD_29: 0x29, // 0x0048c0c0, "sphinx"/"blowup", reads nothing
  HAZARD_2A: 0x2a, // 0x0048d080, "rkhamm02", reads nothing
  HAZARD_2B: 0x2b, // 0x0048c960, "ghostly"/"gtrail", reads nothing
  HAZARD_2C: 0x2c, // 0x0048d8e0, "mmlavbl", reads nothing
  HAZARD_2D: 0x2d, // 0x0048d300, "mmcode1".."mmcode3", reads nothing
  HAZARD_2E: 0x2e, // 0x0048e3a0, "mmrocc"/"mmrocof"/"mmrocon", reads nothing
  HAZARD_2F: 0x2f, // 0x0048ea50, reads nothing
  HAZARD_30: 0x30, // 0x0048e710, "dp_def", reads nothing
  HAZARD_32: 0x32, // 0x0048ff50, "crane"/"crneshd", reads nothing
  HAZARD_33: 0x33, // 0x0048f830, "cannonb": `{ 0x37 0x38 0x39 vectors, 0x3a float, 0x3b integer }`
  HAZARD_34: 0x34, // 0x0048ee00: `{ 0x3b integer, 0x41 name, 0x42 name (up to four) }`
  HAZARD_36: 0x36, // 0x0048b110: name, float, float
  HAZARD_3D: 0x3d, // 0x0048f2b0: `{ 0x37 / 0x38 point lists ... 0x33 block }`
  HAZARD_3E: 0x3e, // 0x0048bbf0: `{ name, integer, float, three floats }`
  HAZARD_3F: 0x3f, // 0x0048b380, reads nothing
  HAZARD_40: 0x40, // 0x0048b580: `{ 0x37 vector, 0x3b integer, 0x42 name, 0x46 integer, 0x47 vector }`
  HAZARD_43: 0x43, // 0x0048c530: `{ 0x3b integer, 0x42 name, 0x44 integer, 0x45 name }`
  HAZARD_48: 0x48, // 0x0048de10: `{ 0x3b integer, 0x42 name and three floats }`
  HAZARD_49: 0x49, // 0x0048af10, reads nothing
})

// Keywords inside the hazard blocks.
export const HazardBlockKeyword = Object.freeze({
  POINT_LIST: 0x37, // in 0x3d: `[ count ] { (3 floats, integer) * count }`
  SECOND_POINT_LIST: 0x38, // in 0x3d
  FIRST_VECTOR: 0x37,
  SECOND_VECTOR: 0x38,
  THIRD_VECTOR: 0x39,
  SQUARED_FLOAT: 0x3a, // stored squared
  INTEGER: 0x3b,
  OBJECT_NAME: 0x41,
  NAME: 0x42,
  SECOND_INTEGER_44: 0x44,
  SECOND_NAME: 0x45,
  SECOND_INTEGER_46: 0x46,
  SECOND_VECTOR_47: 0x47,
})

export const HAZARDS_WITHOUT_DATA: ReadonlySet<number> = new Set([
  HazardKeyword.HAZARD_28,
  HazardKeyword.HAZARD_29,
  HazardKeyword.HAZARD_2A,
  HazardKeyword.HAZARD_2B,
  HazardKeyword.HAZARD_2C,
  HazardKeyword.HAZARD_2D,
  HazardKeyword.HAZARD_2E,
  HazardKeyword.HAZARD_2F,
  HazardKeyword.HAZARD_30,
  HazardKeyword.HAZARD_32,
  HazardKeyword.HAZARD_3F,
  HazardKeyword.HAZARD_49,
])

export const NAME_MAXIMUM_LENGTH = 8
// 0x0048ee00 copies 0x42 names into a four-slot stack buffer.
export const MAXIMUM_NAME_COUNT = 4
