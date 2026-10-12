import { getHudLayout } from '../hud-layout/hud-layout.ts'
import type {
  HudImagePartCommand,
  HudMinimap,
  HudPolygonCommand,
} from '../../types/race-hud.types.ts'
import { getMinimapCommands } from './hud-minimap.ts'

const layout = getHudLayout({
  screenWidth: 640,
  screenHeight: 480,
  measureText: () => ({ width: 10, height: 16 }),
  getString: () => 'TEXT',
  holderSize: { width: 64, height: 64 },
})

// The first race's display bounds, in file order (race description keyword 0x46).
const minimap: HudMinimap = {
  displayBounds: [-700, 700, 800, -800],
  isMirrored: false,
  mapImageName: 'IGD_MAP',
  racers: [
    { position: { x: 800, y: -800 }, isComputer: false },
    { position: { x: 800, y: -800 }, isComputer: true },
    { position: { x: 800, y: -800 }, isComputer: true },
  ],
  ownIndex: 0,
  ownHeading: { x: 1, y: 0 },
}

const getPolygons = (commands: ReturnType<typeof getMinimapCommands>) =>
  commands.filter((command): command is HudPolygonCommand => command.kind === 'polygon')

describe('getMinimapCommands, 0x004249b0', () => {
  it('draws the map as two triangles over a 128 pixel square with its corner 15 pixels inside the screen', () => {
    // Arrange / Act
    const polygons = getPolygons(getMinimapCommands(layout, minimap)).filter(
      (polygon) => polygon.imageName !== null
    )

    // Assert
    const xs = polygons.flatMap((polygon) => polygon.vertices.map((vertex) => vertex.x))
    const ys = polygons.flatMap((polygon) => polygon.vertices.map((vertex) => vertex.y))
    expect(polygons).toHaveLength(2)
    expect(Math.min(...xs)).toBeCloseTo(497, 3)
    expect(Math.max(...xs)).toBe(625)
    expect(Math.min(...ys)).toBeCloseTo(337, 3)
    expect(Math.max(...ys)).toBe(465)
  })

  it('turns the picture over on a mirrored track', () => {
    // Arrange / Act
    const normal = getPolygons(getMinimapCommands(layout, minimap))[0]
    const mirrored = getPolygons(getMinimapCommands(layout, { ...minimap, isMirrored: true }))[0]

    // Assert
    expect(normal?.vertices[0].v).toBeCloseTo(0.999, 3)
    expect(mirrored?.vertices[0].v).toBe(0)
  })

  it('draws a 16 pixel dot centred on each other racer, the second computer in the second cell', () => {
    // Arrange / Act
    const dots = getMinimapCommands(layout, minimap).filter(
      (command): command is HudImagePartCommand => command.kind === 'image_part'
    )

    // Assert
    expect(dots.map((dot) => [dot.x, dot.y, dot.width, dot.height])).toEqual([
      [617, 457, 16, 16],
      [617, 457, 16, 16],
    ])
    expect(dots.map((dot) => dot.source[0])).toEqual([0, 16])
  })

  it('draws the player as a black arrow with a green one on it, pointing along its heading', () => {
    // Arrange / Act
    const arrows = getPolygons(getMinimapCommands(layout, minimap)).filter(
      (polygon) => polygon.imageName === null
    )

    // Assert
    expect(arrows.map((arrow) => arrow.vertices[0].color)).toEqual([0xff000000, 0xff00ff00])
    expect(arrows[0]?.vertices[0].x).toBe(634.5)
    expect(arrows[0]?.vertices[0].y).toBe(465)
    expect(arrows[1]?.vertices[0].x).toBe(633)
  })

  it('leaves the map out when the world has no picture', () => {
    // Arrange / Act
    const polygons = getPolygons(getMinimapCommands(layout, { ...minimap, mapImageName: null }))

    // Assert
    expect(polygons.every((polygon) => polygon.imageName === null)).toBe(true)
  })
})
