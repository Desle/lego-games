import { defineTouchDifferential } from '../hazard-differential/hazard-touch-differential-suite.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { ROCK } from './rock.ts'

const test = createTestSession()
const FLAG_WORD = 0x58 / 4

// FUN_0048e660, the touch of the rock (vtable 0x004b456c slot +0): a shielded racer clears the swap flag at +0x58.
defineTouchDifferential({
  name: 'the rock',
  label: '0x0048e660',
  address: 0x0048e660,
  behavior: ROCK,
  instance: ROCK.create({ keyword: 0x2e }, { isMirrored: false, session: test.session }),
  getHazardWords: () => Array.from({ length: 0x20 }, (_, index) => (index === FLAG_WORD ? 1 : 0)),
  getOriginalState: (words) => String(words[FLAG_WORD]),
  getPortState: (instance) => String('flag' in instance.data ? instance.data.flag : -1),
})
