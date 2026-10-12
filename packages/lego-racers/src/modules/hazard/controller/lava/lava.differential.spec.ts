import { defineTouchDifferential } from '../hazard-differential/hazard-touch-differential-suite.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { LAVA } from './lava.ts'

const test = createTestSession()

// FUN_0048dcd0, the touch of the lava monster (vtable 0x004b44e0 slot +0).
defineTouchDifferential({
  name: 'the lava monster',
  label: '0x0048dcd0',
  address: 0x0048dcd0,
  behavior: LAVA,
  instance: LAVA.create({ keyword: 0x2c }, { isMirrored: false, session: test.session }),
  getHazardWords: () => Array.from({ length: 0x20 }, () => 0),
  getOriginalState: () => '',
  getPortState: () => '',
})
