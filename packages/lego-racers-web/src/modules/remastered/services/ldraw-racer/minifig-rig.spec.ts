import { MinifigPosture } from './minifig-rig.types.ts'
import { getMinifigRig } from './minifig-rig.ts'

const SEATED_BONES = ['rrpelvis', 'torso', 'arm_l', 'arm_r', 'dummy01', 'head']
const STANDING_BONES = [
  'rr',
  'manrr',
  'l_th2269',
  'l_kn1623',
  'l_an2272',
  'l_ba1644',
  'l_toebrr',
  'l_legrr',
  'r_th2269',
  'r_kn1623',
  'r_an2272',
  'waistbrr',
  'chestbrr',
  'neckbrr',
  'dummyrr',
  'head-rr',
  'l_sh2296',
  'l_armrr',
  'l_el2323',
  'l_wr2329',
  'l_handrr',
  'r_sh2296',
  'r_wr2329',
  'r_handrr',
]

// King Kahuka in the second circuit's introduction (`CIRCUIT2\\DUMMY01.SDB`): a dummy walks the figure about, the head is named
// after its hat, and the bones' names are the cinema's own.
const CINEMA_BONES: readonly (readonly [string, number | null])[] = [
  ['dummy01', null],
  ['guy1', 0],
  ['manrr', 1],
  ['l_th2269', 2],
  ['l_kn1623', 3],
  ['l_an2272', 4],
  ['r_th2269', 2],
  ['r_kn1623', 6],
  ['r_an2272', 7],
  ['waistbrr', 1],
  ['ches1360', 9],
  ['neckbrr', 10],
  ['dummyrr', 11],
  ['kk_hat', 12],
  ['face', 13],
  ['l_sh2296', 11],
  ['l_el2323', 15],
  ['l_wrstvv', 16],
  ['l_ha1358', 17],
  ['r_sh2296', 11],
  ['r_el2323', 19],
  ['r_wrstvv', 20],
  ['r_ha1358', 21],
]
const CINEMA_NAMES = CINEMA_BONES.map(([name]) => name)
const CINEMA_PARENTS = CINEMA_BONES.map(([, parent]) => parent)

describe('getMinifigRig', () => {
  it('knows the race driver skeleton and puts the head on the dummy that carries it', () => {
    // Arrange / Act
    const rig = getMinifigRig(SEATED_BONES, [])

    // Assert
    expect([rig?.posture, rig?.torsoIndex, rig?.headIndex]).toEqual([MinifigPosture.SEATED, 1, 4])
  })

  it("points a seated driver's legs forward with the pelvis and his arms with their bones", () => {
    // Arrange / Act
    const rig = getMinifigRig(SEATED_BONES, [])

    // Assert
    expect([rig?.limbs.legs.left, rig?.limbs.arms.right.kind]).toEqual([
      { kind: 'bone', boneIndex: 0, bindDirection: [0, 0, -1] },
      'bone',
    ])
  })

  it('knows the menus skeleton and lets an arm follow the line from its shoulder to its wrist', () => {
    // Arrange / Act
    const rig = getMinifigRig(STANDING_BONES, [])

    // Assert
    expect([rig?.posture, rig?.limbs.arms.left]).toEqual([
      MinifigPosture.STANDING,
      {
        kind: 'chord',
        startIndex: STANDING_BONES.indexOf('l_sh2296'),
        endIndex: STANDING_BONES.indexOf('l_wr2329'),
      },
    ])
  })

  it('lets a leg follow the line from its thigh to its ankle', () => {
    // Arrange / Act
    const rig = getMinifigRig(STANDING_BONES, [])

    // Assert
    expect(rig?.limbs.legs.right).toEqual({
      kind: 'chord',
      startIndex: STANDING_BONES.indexOf('r_th2269'),
      endIndex: STANDING_BONES.indexOf('r_an2272'),
    })
  })

  it('twists the hands only when the skeleton has an elbow, a wrist and a hand on each side', () => {
    // Arrange / Act
    const withoutRightElbow = getMinifigRig(STANDING_BONES, [])
    const complete = getMinifigRig([...STANDING_BONES, 'r_el2323'], [])

    // Assert
    expect([withoutRightElbow?.wrists, complete?.wrists?.right.forearmIndex]).toEqual([
      null,
      STANDING_BONES.length,
    ])
  })

  it('knows no other skeleton', () => {
    // Arrange / Act
    const rig = getMinifigRig(['dajmw', 'da_frt', 'da_brt'], [])

    // Assert
    expect(rig).toBeNull()
  })

  it("carries a cinema's figure by the bone its waist hangs from, not by the dummy that walks it", () => {
    // Arrange / Act
    const rig = getMinifigRig(CINEMA_NAMES, CINEMA_PARENTS)

    // Assert
    expect([rig?.posture, rig?.pelvisIndex, rig?.torsoIndex]).toEqual([
      MinifigPosture.STANDING,
      CINEMA_NAMES.indexOf('guy1'),
      CINEMA_NAMES.indexOf('ches1360'),
    ])
  })

  it("turns a cinema's figure's head with the first bone below the dummy on its neck", () => {
    // Arrange / Act
    const rig = getMinifigRig(CINEMA_NAMES, CINEMA_PARENTS)

    // Assert
    expect(rig?.headIndex).toBe(CINEMA_NAMES.indexOf('kk_hat'))
  })

  it("twists a cinema's figure's hands by their bones of the cinema's own names", () => {
    // Arrange / Act
    const rig = getMinifigRig(CINEMA_NAMES, CINEMA_PARENTS)

    // Assert
    expect([rig?.wrists?.left.wristIndex, rig?.wrists?.right.handIndex]).toEqual([
      CINEMA_NAMES.indexOf('l_wrstvv'),
      CINEMA_NAMES.indexOf('r_ha1358'),
    ])
  })
})
