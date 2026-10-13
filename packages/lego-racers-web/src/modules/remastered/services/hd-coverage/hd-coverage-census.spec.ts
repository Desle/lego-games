import { BoxGeometry, Group, Mesh, Scene } from 'three'
import type { Object3D } from 'three'
import { HookKind } from './hd-coverage.types.ts'
import type { HookCall } from './hd-coverage.types.ts'
import { takeCensus } from './hd-coverage-census.ts'

const getInstanceGroup = (meshPath: string, worldPath: string, name: string): Group => {
  const group = new Group()
  group.name = name
  Object.assign(group.userData, { meshPath, worldPath })
  group.add(new Mesh(new BoxGeometry()))
  return group
}

const CALL: HookCall = {
  id: 7,
  hook: HookKind.CAR,
  key: 'VVCM',
  wheelsKey: 'VVJMW',
  isModelPresent: true,
  isDrawingReturned: true,
  isFailed: false,
}

describe('takeCensus', () => {
  it('sees the original racer meshes and the drawings by their call, and skips what is hidden', () => {
    // Arrange
    const scene = new Scene()
    const body = getInstanceGroup('GAMEDATA\\COMMON\\VVCM.GDB', 'GAMEDATA\\COMMON', 'vvcm')
    const hiddenDriver = getInstanceGroup('GAMEDATA\\COMMON\\VVPELVIS.GDB', 'GAMEDATA\\COMMON', 'd')
    hiddenDriver.visible = false
    const track = getInstanceGroup('GAMEDATA\\R\\TRACK.GDB', 'GAMEDATA\\R\\R.WDB', 'track')
    const drawing = new Group()
    drawing.add(new Mesh(new BoxGeometry()))
    scene.add(body, hiddenDriver, track, drawing)
    const getCallId = (object: Object3D) => (object === drawing ? CALL.id : null)

    // Act
    const census = takeCensus(scene, [CALL], getCallId, ['VVCM'])

    // Assert
    expect(census.sightings).toEqual([
      { origin: 'original', kind: 'body', key: 'VVCM', callId: null },
      { origin: 'layer', kind: 'body', key: 'VVCM', callId: 7 },
    ])
    expect(census.otherSources).toEqual(['GAMEDATA\\R\\R.WDB|GAMEDATA\\R\\TRACK.GDB|track'])
  })
})
