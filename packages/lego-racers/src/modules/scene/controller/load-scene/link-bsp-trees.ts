import { parseBspTree } from '../../../bsp-tree/index.ts'
import { getArchivePath, getNameWithDefaultExtension } from '../../types/scene-path/scene-path.ts'
import type { SceneBspTree } from '../../types/scene.types.ts'
import type { SceneFileSource } from './load-scene.types.ts'

// 0x10017ac0 appends ".bdf" to these names; the reader's default ".bdb" (0x1005cc80) replaces it.
const BSP_TREE_LIST_EXTENSION = '.bdf'
const BSP_TREE_EXTENSION = '.bdb'

// GolDP.dll 0x1001ae50 for each name in the world's BSP tree list (keyword 0x2d).
export const linkBspTrees = (
  source: SceneFileSource,
  names: readonly string[]
): readonly SceneBspTree[] =>
  Object.freeze(
    names.map((name) => {
      const path = getArchivePath(
        source.directory,
        getNameWithDefaultExtension(name + BSP_TREE_LIST_EXTENSION, BSP_TREE_EXTENSION)
      )
      return Object.freeze({ name, path, tree: parseBspTree(source.archive.readFile(path)) })
    })
  )
