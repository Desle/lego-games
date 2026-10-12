import { defineTouchDifferential } from '../hazard-differential/hazard-touch-differential-suite.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { CRANE } from './crane.ts'

const test = createTestSession()

// FUN_00490490, the touch of the crane (vtable 0x004b4734 slot +0).
defineTouchDifferential({
  name: 'the crane',
  label: '0x00490490',
  address: 0x00490490,
  behavior: CRANE,
  instance: CRANE.create({ keyword: 0x32 }, { isMirrored: false, session: test.session }),
  getHazardWords: () => Array.from({ length: 0x20 }, () => 0),
  getOriginalState: () => '',
  getPortState: () => '',
})
