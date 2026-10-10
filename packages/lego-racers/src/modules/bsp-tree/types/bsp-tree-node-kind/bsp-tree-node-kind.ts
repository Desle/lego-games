import { createEnum } from '../../../../shared/types/enum.types.ts'

// Word +0 of a node: 0 for a node with child indices (keyword 0x28), 1 for one without (0x29).
export const BspTreeNodeKind = createEnum({
  BRANCH: 'branch',
  LEAF: 'leaf',
})
