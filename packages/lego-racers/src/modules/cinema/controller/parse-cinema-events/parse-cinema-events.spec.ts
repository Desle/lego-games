import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseCinemaEvents } from './parse-cinema-events.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

describe('parseCinemaEvents', () => {
  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'reads the snow emitters and the flash of the race previews',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))

      // Act
      const events = parseCinemaEvents(archive.readFile('MENUDATA\\SINGRACE\\PST.CEB'))

      // Assert
      expect(events.poolNames).toEqual(['pst'])
      expect(events.emitterEvents).toEqual([
        { name: 'snow1', poolIndex: 0, emitterName: 'snow' },
        { name: 'snow2', poolIndex: 0, emitterName: 'snow' },
      ])
      expect(events.vertexEffects).toEqual([
        { name: 'vtx1', integers: [64, 0, 0], materialName: 'mm_sky' },
      ])
      const starts = events.reactionLists.find((list) => list.listKeyword === 0x56)?.starts
      expect(starts?.map((reaction) => [reaction.entryName, reaction.targetName])).toEqual([
        ['MM_FLSH', 'vtx1'],
        ['snow1-', 'snow1'],
        ['snow2-', 'snow2'],
      ])
      expect(events.reactionLists.find((list) => list.listKeyword === 0x57)?.stops).toHaveLength(3)
    }
  )
})
