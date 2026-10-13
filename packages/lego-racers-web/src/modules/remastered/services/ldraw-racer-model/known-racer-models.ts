// The body codes of the 20 champions' cars (the model names of `CHAMPS.CCB`, upper case): a hand-built `<CODE>.ldr` in the models folder
// replaces the car of that champion.
export const CHAMPION_CAR_CODES: readonly string[] = Object.freeze([
  'VVCM',
  'RRCM',
  'BKCM',
  'RKCM',
  'RHCM',
  'CCCM',
  'ACM',
  'PHCM',
  'GBCM',
  'BHCM',
  'SSCM',
  'TCCM',
  'NHCM',
  'APCM',
  'KKCM',
  'CRCM',
  'BVBCM',
  'JTCM',
  'BBCM',
  'GMCM',
])

// The 12 chassis parts of the game (lower case): a recipe `chassis/<NAME>.ldr` in the models folder builds one from standard parts.
export const CHASSIS_NAMES: readonly string[] = Object.freeze([
  'jtchas0',
  'gm_chas0',
  'bvbcha0',
  'bbchas0',
  'crchas0',
  'kkchas0',
  'dachas0',
  'dbchas0',
  'dcchas0',
  'ddchas0',
  'rrchas0',
  'vvchas0',
])

// The chassis the other 12 champions' cars stand on (lower case); no garage design uses them, so they are not in CHASSIS_NAMES.
export const CHAMPION_CHASSIS_NAMES: readonly string[] = Object.freeze([
  'bkchas0',
  'rkchas0',
  'rhchas0',
  'ccchas0',
  'achas0',
  'phchas0',
  'gbchas0',
  'bhchas0',
  'sbchas0',
  'tcchas0',
  'nhchas0',
  'apchas0',
])
