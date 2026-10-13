import type {
  RaceRenderPass,
  RaceRenderRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { BufferGeometry, Light, LineSegments, Mesh } from 'three'
import type { Object3D, Scene } from 'three'
import { DetailSwitch } from '@lego-games/ldraw/geometry'
import type { HeaviestRow, PerformanceSnapshot } from './performance-monitor.types.ts'

const PERFORMANCE_PARAMETER = 'perf'
const REPORT_INTERVAL_MILLISECONDS = 1000
const BYTES_PER_MEGABYTE = 1024 * 1024
const MILLISECONDS_PER_SECOND = 1000

export const getIsPerformanceRequested = (search: string): boolean =>
  new URLSearchParams(search).has(PERFORMANCE_PARAMETER)

// Milliseconds the layer's drawings took to arrive (parts parsed and built), summed over the cars and drivers of the page.
let loadMilliseconds = 0

export const addLoadMilliseconds = (milliseconds: number) => {
  loadMilliseconds += milliseconds
}

const workMilliseconds = new Map<string, number>()

// Runs a piece of the layer's own work and adds its time to the label's total (`window.legoWork` lists the totals): where loading goes.
export const measureWork = <Result>(label: string, work: () => Result): Result => {
  const start = performance.now()
  const result = work()
  workMilliseconds.set(label, (workMilliseconds.get(label) ?? 0) + performance.now() - start)
  Reflect.set(window, 'legoWork', Object.fromEntries(workMilliseconds))
  return result
}

const getHeapMegabytes = (): number => {
  const memory: unknown = Reflect.get(performance, 'memory')
  const used: unknown = memory instanceof Object ? Reflect.get(memory, 'usedJSHeapSize') : 0
  return typeof used === 'number' ? used / BYTES_PER_MEGABYTE : 0
}

const getWhole = (value: number): string => value.toFixed(0)

const getReportLine = (snapshot: PerformanceSnapshot): string =>
  [
    `${getWhole(snapshot.drawCalls)} calls  ${getWhole(snapshot.triangles / 1000)}k tris  ${getWhole(snapshot.lineSegments)} lines`,
    `shadow ${getWhole(snapshot.shadowDrawCalls)} calls ${getWhole(snapshot.shadowTriangles / 1000)}k tris ${snapshot.shadowMilliseconds.toFixed(1)} ms`,
    `${getWhole(snapshot.geometries)} geo  ${getWhole(snapshot.textures)} tex  ${getWhole(snapshot.programs)} prog`,
    `${snapshot.frameMilliseconds.toFixed(1)} ms (${getWhole(MILLISECONDS_PER_SECOND / Math.max(snapshot.frameMilliseconds, 1))} fps)`,
    `${getWhole(snapshot.heapMegabytes)} MB  load ${getWhole(snapshot.loadMilliseconds)} ms`,
  ].join('\n')

const createOverlay = (): HTMLElement => {
  const element = document.createElement('pre')
  element.style.cssText =
    'position:fixed;left:4px;top:4px;margin:0;padding:4px 6px;z-index:99999;pointer-events:none;' +
    'font:11px/1.3 monospace;color:#0f0;background:rgba(0,0,0,0.65);white-space:pre'
  document.body.append(element)
  return element
}

const getObjectPrimitiveCount = (
  object: Mesh | LineSegments,
  verticesPerPrimitive: number
): number => {
  const geometry: unknown = object.geometry
  if (!(geometry instanceof BufferGeometry)) return 0
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- `instanceof` leaves the generic parameters of the geometry open
  const buffer: BufferGeometry = geometry
  return (buffer.index?.count ?? buffer.attributes['position']?.count ?? 0) / verticesPerPrimitive
}

// What the scene holds, by kind of drawn object: how many there are and how many primitives and materials they have.
const getSceneBreakdown = (scene: Scene): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {
    meshes: 0,
    meshTriangles: 0,
    lineObjects: 0,
    lineSegments: 0,
    conditionalObjects: 0,
    conditionalSegments: 0,
    lights: 0,
    detailsHigh: 0,
    detailsLow: 0,
  }
  const materials = new Set<unknown>()
  scene.traverseVisible((object) => {
    if (object instanceof DetailSwitch) {
      const key = object.isHighShown ? 'detailsHigh' : 'detailsLow'
      counts[key] = (counts[key] ?? 0) + 1
    }
    if (object instanceof Mesh) {
      counts['meshes'] = (counts['meshes'] ?? 0) + 1
      counts['meshTriangles'] = (counts['meshTriangles'] ?? 0) + getObjectPrimitiveCount(object, 3)
      materials.add(object.material)
    } else if (object instanceof LineSegments) {
      const isConditional = Reflect.get(object, 'isConditionalLine') === true
      const objectKey = isConditional ? 'conditionalObjects' : 'lineObjects'
      const segmentKey = isConditional ? 'conditionalSegments' : 'lineSegments'
      counts[objectKey] = (counts[objectKey] ?? 0) + 1
      counts[segmentKey] = (counts[segmentKey] ?? 0) + getObjectPrimitiveCount(object, 2)
      materials.add(object.material)
    } else if (object instanceof Light) counts['lights'] = (counts['lights'] ?? 0) + 1
  })
  counts['materials'] = materials.size
  return Object.freeze(counts)
}

// For each model with two resolutions: the triangles and line segments of the low one and of the high one, and which is shown.
const getDetailReport = (scene: Scene): readonly string[] => {
  const report: string[] = []
  scene.traverse((object) => {
    if (!(object instanceof DetailSwitch)) return
    const levels = object.getLevels().map((level) => {
      let triangles = 0
      let segments = 0
      level?.traverse((child) => {
        if (child instanceof Mesh) triangles += getObjectPrimitiveCount(child, 3)
        else if (child instanceof LineSegments) segments += getObjectPrimitiveCount(child, 2)
      })
      return `${getWhole(triangles)}t/${getWhole(segments)}l`
    })
    report.push(`${levels.join(' | ')} ${object.isHighShown ? 'high' : 'low'}`)
  })
  return report
}

// The visible triangles and line segments below each object down to a depth, the heaviest first: where a frame's cost sits.
const getHeaviestObjects = (scene: Scene, depth: number): readonly string[] => {
  const rows: HeaviestRow[] = []
  const visit = (object: Object3D, path: string, remaining: number) => {
    let triangles = 0
    let segments = 0
    object.traverseVisible((child) => {
      if (child instanceof Mesh) triangles += getObjectPrimitiveCount(child, 3)
      else if (child instanceof LineSegments) segments += getObjectPrimitiveCount(child, 2)
    })
    rows.push({ label: path, triangles, segments })
    if (remaining === 0) return
    for (const child of object.children) {
      if (child.visible) visit(child, `${path}/${child.name || child.type}`, remaining - 1)
    }
  }
  visit(scene, 'scene', depth)
  return rows
    .sort((first, second) => second.triangles - first.triangles)
    .slice(0, 25)
    .map((row) => `${getWhole(row.triangles)}t ${getWhole(row.segments)}l ${row.label}`)
}

// `?hd&perf`: what the last frames cost, on screen once a second and in `window.legoPerformance`. The main scene's numbers are
// read from the renderer just before the next frame (its info still holds the last main render), the shadow pass's just after it.
export const createPerformancePass = (
  request: RaceRenderRequest,
  inner: RaceRenderPass | null
): RaceRenderPass => {
  const { renderer } = request
  const context = renderer.getContext()
  Reflect.set(window, 'legoSceneBreakdown', () => getSceneBreakdown(request.trackScene))
  Reflect.set(window, 'legoHeaviest', (depth: number) =>
    getHeaviestObjects(request.trackScene, depth)
  )
  Reflect.set(window, 'legoDetailReport', () => getDetailReport(request.trackScene))
  const overlay = createOverlay()
  // The viewport renders three scenes a frame (sky, track, fade): the counts are summed over the frame, so they are reset by hand.
  renderer.info.autoReset = false
  let previousStart = 0
  let frameCount = 0
  let frameTotal = 0
  let shadowTotal = 0
  let lastReport = performance.now()
  let drawCalls = 0
  let triangles = 0
  let lineSegments = 0
  let shadowDrawCalls = 0
  let shadowTriangles = 0
  return {
    beforeRender: () => {
      // Waits for the last frame's GPU work so the time between frames is the whole frame's cost, not only the CPU's.
      context.finish()
      const start = performance.now()
      if (previousStart > 0) {
        frameTotal += start - previousStart
        frameCount += 1
        drawCalls = renderer.info.render.calls
        triangles = renderer.info.render.triangles
        lineSegments = renderer.info.render.lines
      }
      previousStart = start
      renderer.info.reset()
      inner?.beforeRender()
      shadowTotal += performance.now() - start
      if (inner !== null) {
        shadowDrawCalls = renderer.info.render.calls
        shadowTriangles = renderer.info.render.triangles
      }
      renderer.info.reset()
      if (start - lastReport < REPORT_INTERVAL_MILLISECONDS || frameCount === 0) return
      const snapshot: PerformanceSnapshot = Object.freeze({
        drawCalls,
        triangles,
        lineSegments,
        shadowDrawCalls,
        shadowTriangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        frameMilliseconds: frameTotal / frameCount,
        shadowMilliseconds: shadowTotal / frameCount,
        heapMegabytes: getHeapMegabytes(),
        loadMilliseconds,
      })
      Reflect.set(window, 'legoPerformance', snapshot)
      overlay.textContent = getReportLine(snapshot)
      lastReport = start
      frameCount = 0
      frameTotal = 0
      shadowTotal = 0
    },
    dispose: () => {
      inner?.dispose()
      overlay.remove()
    },
  }
}
