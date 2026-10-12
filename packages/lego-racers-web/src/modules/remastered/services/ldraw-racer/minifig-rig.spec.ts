import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
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

describe('getMinifigRig', () => {
  it('knows the race driver skeleton and puts the head on the dummy that carries it', () => {
    // Arrange / Act
    const rig = getMinifigRig(SEATED_BONES)

    // Assert
    expect([rig?.posture, rig?.attachments[MinifigPartKey.HEAD]]).toEqual([
      MinifigPosture.SEATED,
      { kind: 'bone', boneIndex: 4 },
    ])
  })

  it('knows the menus skeleton and lets an arm follow the line from its shoulder to its wrist', () => {
    // Arrange / Act
    const rig = getMinifigRig(STANDING_BONES)

    // Assert
    expect([rig?.posture, rig?.attachments[MinifigPartKey.LEFT_ARM]]).toEqual([
      MinifigPosture.STANDING,
      {
        kind: 'chord',
        startIndex: STANDING_BONES.indexOf('l_sh2296'),
        endIndex: STANDING_BONES.indexOf('l_wr2329'),
        outwardSign: 1,
      },
    ])
  })

  it('splays the right arm the other way and gives a hand the line of its arm', () => {
    // Arrange / Act
    const rig = getMinifigRig(STANDING_BONES)

    // Assert
    expect(rig?.attachments[MinifigPartKey.RIGHT_HAND]).toBe(
      rig?.attachments[MinifigPartKey.RIGHT_ARM]
    )
    expect(rig?.attachments[MinifigPartKey.RIGHT_ARM]).toMatchObject({ outwardSign: -1 })
  })

  it('knows no other skeleton', () => {
    // Arrange / Act
    const rig = getMinifigRig(['dajmw', 'da_frt', 'da_brt'])

    // Assert
    expect(rig).toBeNull()
  })
})
