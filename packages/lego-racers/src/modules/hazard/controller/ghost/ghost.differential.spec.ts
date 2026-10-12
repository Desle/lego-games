import { defineTouchDifferential } from '../hazard-differential/hazard-touch-differential-suite.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { GHOST } from './ghost.ts'

const test = createTestSession()

// FUN_0048ce90, the touch of the ghost (vtable 0x004b43dc slot +0).
defineTouchDifferential({
  name: 'the ghost',
  label: '0x0048ce90',
  address: 0x0048ce90,
  behavior: GHOST,
  instance: GHOST.create({ keyword: 0x2b }, { isMirrored: false, session: test.session }),
  getHazardWords: () => Array.from({ length: 0x20 }, () => 0),
  getOriginalState: () => '',
  getPortState: () => '',
})
