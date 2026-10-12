import { MinifigPartConfidence } from './ldraw-minifig-parts.types.ts'
import type {
  LDrawFaceMatch,
  LDrawHat,
  LDrawHatMatch,
  LDrawLegsMatch,
  LDrawTorsoMatch,
} from './ldraw-minifig-parts.types.ts'

const BLACK = 0
const BLUE = 1
const GREEN = 2
const RED = 4
const BROWN = 6
const LIGHT_GRAY = 7
const DARK_GRAY = 8
const YELLOW = 14
const WHITE = 15
const TAN = 19
const LIGHT_BLUISH_GRAY = 71
const DARK_BLUISH_GRAY = 72

const { EXACT, CLOSE, GUESS } = MinifigPartConfidence
const PLAIN_LEFT_LEG = '3817b'
const PLAIN_RIGHT_LEG = '3816b'

const getHat = (part: string, colorCode: number): LDrawHat => Object.freeze({ part, colorCode })

const getHatMatch = (
  catalogName: string,
  confidence: LDrawHatMatch['confidence'],
  source: string,
  ...hats: readonly LDrawHat[]
): LDrawHatMatch => Object.freeze({ catalogName, confidence, source, hats: Object.freeze(hats) })

const getFaceMatch = (
  catalogName: string,
  part: string,
  colorCode: number,
  confidence: LDrawFaceMatch['confidence'],
  source: string
): LDrawFaceMatch => Object.freeze({ catalogName, part, colorCode, confidence, source })

const getTorsoMatch = (
  catalogName: string,
  confidence: LDrawTorsoMatch['confidence'],
  source: string,
  print: readonly [string, number, number, number] | null
): LDrawTorsoMatch =>
  Object.freeze({
    catalogName,
    confidence,
    source,
    print:
      print === null
        ? null
        : Object.freeze({
            part: print[0],
            torsoColorCode: print[1],
            armColorCode: print[2],
            handColorCode: print[3],
          }),
  })

const getLegsMatch = (
  catalogName: string,
  confidence: LDrawLegsMatch['confidence'],
  source: string,
  hipsColorCode: number,
  leftLeg: LDrawHat,
  rightLeg: LDrawHat
): LDrawLegsMatch =>
  Object.freeze({ catalogName, confidence, source, hipsColorCode, leftLeg, rightLeg })

const getPlainLegsMatch = (
  catalogName: string,
  source: string,
  hipsColorCode: number,
  legsColorCode: number
): LDrawLegsMatch =>
  getLegsMatch(
    catalogName,
    CLOSE,
    source,
    hipsColorCode,
    getHat(PLAIN_LEFT_LEG, legsColorCode),
    getHat(PLAIN_RIGHT_LEG, legsColorCode)
  )

// The hats of `BODYPART.PCB` by catalogue index (its `0x29` list) and the library parts that stand for each, in the colour the game paints
// it. A champion's hat is the one of the official figure; the library has no part for some (the cobra helmet, the tribal headdress).
export const LDRAW_HATS: readonly LDrawHatMatch[] = Object.freeze([
  getHatMatch('nohat', EXACT, 'bare head'),
  getHatMatch('helmtrr', CLOSE, 'classic racing helmet, Racers', getHat('3842a', BLACK)),
  getHatMatch('helmet2s', CLOSE, 'castle helmet with chin guard, Castle', getHat('3896', BLACK)),
  getHatMatch('bb_hats', EXACT, 'fig-000648 Bat Lord, Fright Knights', getHat('30105', BLACK)),
  getHatMatch(
    'cr_hats',
    EXACT,
    'fig-005505 Captain Redbeard (21322): bicorne with skull and bones',
    getHat('2528ap3d', BLACK)
  ),
  getHatMatch('gb_hats', GUESS, 'Imperial governor bicorne, Pirates', getHat('2528a', WHITE)),
  getHatMatch(
    'jt_hats',
    EXACT,
    'fig-000359 Johnny Thunder (5938 Oasis Ambush, 1998)',
    getHat('30167', BROWN)
  ),
  getHatMatch(
    'kk_hats',
    EXACT,
    'fig-001092 King Kahuka (6236, 1994): mask and plume',
    getHat('6030', RED),
    getHat('87696', WHITE)
  ),
  getHatMatch('sb_hats', CLOSE, 'top hat', getHat('3878', BLACK)),
  getHatMatch(
    'vb_hats',
    EXACT,
    'fig-000629 Baron Von Barron (5948 Desert Expedition, 1998): pith helmet',
    getHat('30172', WHITE)
  ),
  getHatMatch('tc_hats', GUESS, 'feathered headdress, Western', getHat('30138', RED)),
  getHatMatch(
    'ap_hats',
    GUESS,
    'nearest helmet, no cobra helm in the library',
    getHat('30171b', BLACK)
  ),
  getHatMatch('cc_hats', CLOSE, 'diving helmet, Aquazone', getHat('30090b', WHITE)),
  getHatMatch('ch_hats', CLOSE, 'cowboy hat, Western', getHat('3629', WHITE)),
  getHatMatch('nh_hats', GUESS, 'space helmet, visor not drawn', getHat('71016', BLACK)),
  getHatMatch('gh_hai1s', CLOSE, 'spiked hair', getHat('2631', LIGHT_GRAY)),
  getHatMatch('gh_hai2s', CLOSE, 'spiked hair', getHat('2631', BROWN)),
  getHatMatch('gh_hairs', CLOSE, 'spiked hair', getHat('2631', BLACK)),
  getHatMatch('ww_hats', CLOSE, 'wizard hat', getHat('6131', BLACK)),
  getHatMatch('il_hairs', GUESS, 'tall flat hat', getHat('44553', BLACK)),
  getHatMatch('mh_hairs', CLOSE, 'male hair', getHat('3901', BLACK)),
  getHatMatch('mh_hai1s', CLOSE, 'male hair', getHat('3901', LIGHT_GRAY)),
  getHatMatch('mh_hai2s', CLOSE, 'male hair', getHat('3901', BROWN)),
  getHatMatch('rk_hats', GUESS, 'long hair with a crown', getHat('18835', YELLOW)),
  getHatMatch('al_hats', GUESS, 'wide brimmed hat', getHat('13788', BLACK)),
  getHatMatch('bk_hats', CLOSE, 'castle helmet with grille, Castle', getHat('4503', BLACK)),
  getHatMatch(
    'pm_hats',
    EXACT,
    'fig-000526 Pharaoh Hotep (5988, 1998): nemes headdress (the blue and gold print is not in the library)',
    getHat('30168b', YELLOW)
  ),
  getHatMatch('bj_hats', CLOSE, 'tricorne, Pirates', getHat('2544', BLACK)),
  getHatMatch('helmt03', CLOSE, 'classic racing helmet, Racers', getHat('3842a', BLUE)),
  getHatMatch('helmt02', CLOSE, 'classic racing helmet, Racers', getHat('3842a', RED)),
  getHatMatch('helmt01', CLOSE, 'classic racing helmet, Racers', getHat('3842a', WHITE)),
  getHatMatch('ad_hats', GUESS, 'beanie, robot top not in the library', getHat('90541', GREEN)),
  getHatMatch('mm_hats', CLOSE, 'cap, Racers', getHat('86035', BLUE)),
  getHatMatch('mj_hats', CLOSE, 'wizard hat', getHat('6131', BLUE)),
  getHatMatch('rh_hats', CLOSE, 'forestman cap with plume, Castle', getHat('4506c01', GREEN)),
  getHatMatch('helmtvvs', CLOSE, 'classic racing helmet, Racers', getHat('3842a', LIGHT_GRAY)),
])

// The faces of `BODYPART.PCB` by catalogue index (the heads list), each a printed head of the library: the game's face card says
// what the print shows, the figure's character says which one.
export const LDRAW_FACES: readonly LDrawFaceMatch[] = Object.freeze([
  getFaceMatch('lh_', '3626bp01', YELLOW, GUESS, 'standard grin'),
  getFaceMatch(
    'kk_',
    '3626bp3k',
    YELLOW,
    EXACT,
    'fig-001092 King Kahuka (6236, 1994): white and blue face paint'
  ),
  getFaceMatch('jt_', '3626bpa3', YELLOW, EXACT, 'fig-000359 Johnny Thunder (5938, 1998)'),
  getFaceMatch('gm_', '3626bp53', BLUE, EXACT, 'fig-000451 Gypsy Moth (3073 Booster, 1999)'),
  getFaceMatch(
    'cr_',
    '3626bp47',
    YELLOW,
    CLOSE,
    'Pirates: eye patch on the right, red moustache and beard'
  ),
  getFaceMatch('bb_', '3626bp4c', YELLOW, EXACT, 'fig-000648 Bat Lord, Fright Knights'),
  getFaceMatch('gb_', '3626bp07', YELLOW, GUESS, 'freckles: the game shows orange cheeks'),
  getFaceMatch('sb_', '3626bpa9', YELLOW, GUESS, 'glasses and black facial hair'),
  getFaceMatch('tc_', '3626bpac', YELLOW, GUESS, 'tribal paint and frown'),
  getFaceMatch('ap_', '3626bpw4', YELLOW, GUESS, 'orange war paint, Western'),
  getFaceMatch('cc_', '3626bp61', YELLOW, GUESS, 'white moustache and eyebrows, Ice Planet'),
  getFaceMatch('nh_', '3626bp41', YELLOW, GUESS, 'red moustache and goatee'),
  getFaceMatch('ww_', '3626bp4f', YELLOW, GUESS, 'messy black hair, one tooth'),
  getFaceMatch('il_', '3626bp3j', YELLOW, CLOSE, 'white and red face paint, Islanders'),
  getFaceMatch('rh_', '3626bp3e', YELLOW, GUESS, 'wiry moustache, goatee and eyebrows'),
  getFaceMatch('rk_', '3626bp4d', YELLOW, GUESS, 'red moustache, eyebrows and hair'),
  getFaceMatch('al_', '3626bp44', YELLOW, GUESS, 'black moustache, beard and messy hair'),
  getFaceMatch('bk_', '3626bp4m', YELLOW, GUESS, 'black bushy moustache and hair'),
  getFaceMatch('pm_', '3626bpa2', LIGHT_GRAY, EXACT, 'fig-000526 Pharaoh Hotep (5988, 1998)'),
  getFaceMatch('bj_', '3626bp39', YELLOW, GUESS, 'grin, dark grey beard and eyebrows'),
  getFaceMatch('ad_', '3626bp64', BLACK, CLOSE, 'robot with gold circuitry on black, Insectoids'),
  getFaceMatch(
    'vb_',
    '3626bpa7',
    YELLOW,
    EXACT,
    'fig-000629 Baron Von Barron (5948, 1998): monocle'
  ),
  getFaceMatch('lg_', '3626bp6f', YELLOW, GUESS, 'red lips and upswept eyelashes'),
  getFaceMatch('lm_', '3626bp0c', YELLOW, GUESS, 'thick moustache and short eyebrows'),
  getFaceMatch('ls_', '3626bp6u', YELLOW, GUESS, 'gold paint, fangs and slanted eyes'),
  getFaceMatch('wc_', '3626bp04', YELLOW, GUESS, 'grin and sunglasses'),
  getFaceMatch('sk_', '3626bpa8', YELLOW, GUESS, 'evil skeleton skull'),
  getFaceMatch('gs_', '3626bpao', YELLOW, GUESS, 'big eyes and orange mouth'),
  getFaceMatch(
    'rr_',
    '3626cp40',
    YELLOW,
    EXACT,
    'fig-011825 Rocket Racer (60298, 2021): eyebrows, goatee and smirk'
  ),
  getFaceMatch('vv_', '3626bp09', YELLOW, GUESS, 'female, brown eyebrows, pupils and eyelashes'),
])

// The torsos of `BODYPART.PCB` by catalogue index: the library's printed torso (body, arm and hand colours as the official figure has
// them), or none where no print reads like the game's picture (the picture stays, clipped to the front of the torso).
export const LDRAW_TORSOS: readonly LDrawTorsoMatch[] = Object.freeze([
  getTorsoMatch('tu_chst', CLOSE, 'Racers: red jacket, Octan, TEAM 1 RACING', [
    '973p80',
    RED,
    RED,
    YELLOW,
  ]),
  getTorsoMatch('kk_chst', EXACT, 'fig-001092 King Kahuka (6236, 1994): bone necklace', [
    '973p3h',
    YELLOW,
    YELLOW,
    YELLOW,
  ]),
  getTorsoMatch('bb_chst', EXACT, 'fig-000648 Bat Lord, Fright Knights: bat lord tunic', [
    '973p4i',
    RED,
    BLACK,
    YELLOW,
  ]),
  getTorsoMatch('jt_chst', EXACT, 'fig-000359 Johnny Thunder (5938, 1998): red bandana, gun', [
    '973pa3',
    TAN,
    TAN,
    YELLOW,
  ]),
  getTorsoMatch('vb_chst', EXACT, 'fig-000629 Baron Von Barron (5948, 1998): safari shirt', [
    '973pa7',
    TAN,
    TAN,
    BLACK,
  ]),
  getTorsoMatch('gm_chst', EXACT, 'fig-000451 Gypsy Moth (3073, 1999): insectoid female', [
    '973p58',
    BLACK,
    DARK_GRAY,
    BLUE,
  ]),
  getTorsoMatch('rk_chst', CLOSE, 'Castle: lion head and gold collar on red and white', [
    '973p4e',
    RED,
    WHITE,
    YELLOW,
  ]),
  getTorsoMatch('nh_chst', CLOSE, 'white with a black ring and a yellow arrowhead', [
    '973p55',
    WHITE,
    LIGHT_GRAY,
    BLACK,
  ]),
  getTorsoMatch('al_chst', GUESS, 'red jacket with blue stripes, Pirates', [
    '973p3f',
    RED,
    RED,
    YELLOW,
  ]),
  getTorsoMatch('rh_chst', CLOSE, 'brown vest with a strap, Castle', [
    '973pf8',
    BROWN,
    YELLOW,
    YELLOW,
  ]),
  getTorsoMatch('bj_chst', CLOSE, 'blue jacket with a brown vest, Pirates', [
    '973p39',
    BLUE,
    BLUE,
    YELLOW,
  ]),
  getTorsoMatch('cc_chst', GUESS, 'white and black with a blue emblem', [
    '973p62',
    BLACK,
    WHITE,
    BLUE,
  ]),
  getTorsoMatch('ap_chst', GUESS, 'no print reads like it: the game picture stays', null),
  getTorsoMatch('tc_chst', CLOSE, 'Islanders: feathers and a medallion on yellow', [
    '973pac',
    YELLOW,
    YELLOW,
    RED,
  ]),
  getTorsoMatch('sb_chst', CLOSE, 'black jacket with a red cravat', [
    '973p22',
    BLACK,
    DARK_BLUISH_GRAY,
    YELLOW,
  ]),
  getTorsoMatch(
    'rr_chst',
    GUESS,
    'the flaming RR is not in the library: the game picture stays',
    null
  ),
  getTorsoMatch('gb_chst', GUESS, 'no print reads like it: the game picture stays', null),
  getTorsoMatch('ad_chst', GUESS, 'no print reads like it: the game picture stays', null),
  getTorsoMatch('il_chst', CLOSE, 'Islanders: green and red leaf collar on yellow', [
    '973p3j',
    YELLOW,
    YELLOW,
    YELLOW,
  ]),
  getTorsoMatch('gs_chst', GUESS, 'no print reads like it: the game picture stays', null),
  getTorsoMatch('ww_chst', CLOSE, 'black vest with a red collar and a gold medal', [
    '973p4k',
    BLACK,
    DARK_BLUISH_GRAY,
    YELLOW,
  ]),
  getTorsoMatch('eo_chst', CLOSE, 'red jacket with white stars', ['973p1h', RED, RED, YELLOW]),
  getTorsoMatch('mm_chst', CLOSE, 'Racers: blue jacket with Octan and OIL', [
    '973p81',
    BLUE,
    BLUE,
    YELLOW,
  ]),
  getTorsoMatch('in_chst', CLOSE, 'Racers: white jacket with Octan and RACE TEAM', [
    '973pz4',
    WHITE,
    WHITE,
    YELLOW,
  ]),
  getTorsoMatch('cr_chst', CLOSE, 'Pirates: captain jacket with a green ascot and a strap, hook', [
    '973p36',
    BLACK,
    BLACK,
    YELLOW,
  ]),
  getTorsoMatch('bk_chst', CLOSE, 'black armour with silver ribs, Castle', [
    '973pfb',
    BLACK,
    DARK_BLUISH_GRAY,
    YELLOW,
  ]),
  getTorsoMatch('mj_chst', CLOSE, 'Forestmen: blue tunic with a tied lace and a purse', [
    '973p46',
    BLUE,
    BLUE,
    YELLOW,
  ]),
  getTorsoMatch('pm_chst', EXACT, 'fig-000526 Pharaoh Hotep (5988, 1998): breastplate', [
    '973pa2',
    BLACK,
    BLACK,
    RED,
  ]),
  getTorsoMatch('vv_chst', GUESS, 'grey vest with a gauge and a pocket', [
    '973p29',
    LIGHT_GRAY,
    WHITE,
    YELLOW,
  ]),
])

// The legs of `BODYPART.PCB` by catalogue index: hips colour, and each leg's part and colour. The plain ones follow the game's colours as
// the library paints them; the printed ones are the official figure's.
export const LDRAW_LEGS: readonly LDrawLegsMatch[] = Object.freeze([
  getPlainLegsMatch('leg_blck', 'black legs', BLACK, BLACK),
  getPlainLegsMatch('leg_bkrd', 'black legs, red hips', RED, BLACK),
  getPlainLegsMatch('leg_bkbl', 'black legs, blue hips', BLUE, BLACK),
  getPlainLegsMatch('leg_blue', 'blue legs', BLUE, BLUE),
  getPlainLegsMatch('leg_brwn', 'brown legs', BROWN, BROWN),
  getPlainLegsMatch('leg_dgbk', 'dark grey legs, black hips', BLACK, DARK_BLUISH_GRAY),
  getPlainLegsMatch('leg_dgbl', 'dark grey legs, blue hips', BLUE, DARK_BLUISH_GRAY),
  getPlainLegsMatch('leg_grn', 'green legs', GREEN, GREEN),
  getPlainLegsMatch('leg_dkgr', 'dark grey legs', DARK_BLUISH_GRAY, DARK_BLUISH_GRAY),
  getPlainLegsMatch('leg_ltgr', 'light grey legs', LIGHT_BLUISH_GRAY, LIGHT_BLUISH_GRAY),
  getLegsMatch(
    'leg_peg',
    CLOSE,
    'black left leg, wooden peg right leg, brown hips (Pirates)',
    BROWN,
    getHat(PLAIN_LEFT_LEG, BLACK),
    getHat('2532', BROWN)
  ),
  getPlainLegsMatch('leg_red', 'red legs', RED, RED),
  getPlainLegsMatch('leg_wht', 'white legs', WHITE, WHITE),
  getLegsMatch(
    'tc_leg',
    CLOSE,
    'Islanders: green leaf print on yellow legs (fig-001092 King Kahuka)',
    GREEN,
    getHat('3817cp3j', YELLOW),
    getHat('3816cp3j', YELLOW)
  ),
  getLegsMatch(
    'pm_leg',
    EXACT,
    'fig-000526 Pharaoh Hotep (5988, 1998): green kilt and toes on black legs, green hips',
    GREEN,
    getHat('3817cpa2', BLACK),
    getHat('3816cpa2', BLACK)
  ),
  getPlainLegsMatch('ad_leg', 'white legs (no robot print matches)', WHITE, WHITE),
  getPlainLegsMatch('ap_leg', 'dark grey legs', DARK_BLUISH_GRAY, DARK_BLUISH_GRAY),
  getLegsMatch(
    'kk_leg',
    EXACT,
    'fig-001092 King Kahuka (6236, 1994): green leaf print on yellow legs, green hips',
    GREEN,
    getHat('3817cp3j', YELLOW),
    getHat('3816cp3j', YELLOW)
  ),
  getPlainLegsMatch('rr_leg', 'light grey legs', LIGHT_BLUISH_GRAY, LIGHT_BLUISH_GRAY),
  getPlainLegsMatch('vv_leg', 'light grey legs', LIGHT_BLUISH_GRAY, LIGHT_BLUISH_GRAY),
])
