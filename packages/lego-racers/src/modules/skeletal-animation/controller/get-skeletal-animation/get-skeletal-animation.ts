import type { Animation } from '../../../animation/index.ts'
import type { SkeletalAnimation } from '../../types/skeletal-animation.types.ts'

const UNSIGNED_SHORT_MASK = 0xffff

// Names the fields of a parsed `.ADB` (animation.md) as the pose sampling uses them: the `0x27` block's three
// pools, the `0x2b` entries as one track per bone, the `0x2c` entries as clips. The counts, key times and frame
// counts are unsigned 16-bit values in the engine (`movzx` in 0x10024380, 0x10024540 and 0x10023580).
export const getSkeletalAnimation = (animation: Animation): SkeletalAnimation =>
  Object.freeze({
    positions: animation.keyword28Triples,
    rotations: animation.keyword29Quadruples,
    times: Object.freeze(animation.keyword2aValues.map((time) => time & UNSIGNED_SHORT_MASK)),
    tracks: Object.freeze(
      animation.keyword2bEntries.map(
        ([
          rotationStart,
          rotationTimeStart,
          rotationCount,
          positionStart,
          positionTimeStart,
          positionCount,
        ]) =>
          Object.freeze({
            rotationStart,
            rotationTimeStart,
            rotationCount: rotationCount & UNSIGNED_SHORT_MASK,
            positionStart,
            positionTimeStart,
            positionCount: positionCount & UNSIGNED_SHORT_MASK,
          })
      )
    ),
    clips: Object.freeze(
      animation.keyword2cEntries.map((entry) =>
        Object.freeze({
          name: entry.name,
          framesPerMillisecond: entry.keyword2fValue,
          velocity: entry.keyword30Values,
          firstTrackIndex: entry.keyword2bValue,
          frameCount: entry.keyword2dValue & UNSIGNED_SHORT_MASK,
          loopLength: entry.keyword2eValue,
        })
      )
    ),
  })
