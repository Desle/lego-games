import type {
  ReferenceBounds,
  ReferenceFaces,
  ReferenceSheetContent,
  ReferenceSheetPanel as Panel,
  ReferenceView,
  WheelMount,
} from './reference-kit.types.ts'

const MAXIMUM_PIXELS_PER_STUD = 36
const MAXIMUM_PANEL_PIXELS = 620
const MARGIN = 48
const LABEL_LINE = 18
const AXIS_NAMES: readonly string[] = ['x', 'y', 'z']
const MAJOR_GRID_STEP = 5

// The four views of a sheet in the car's frame (x forward, y to the left, z up), seen from outside: the left side with the front to
// the right (as LDraw shows a model), the top with the front to the right, the front and the back.
export const REFERENCE_VIEWS: readonly ReferenceView[] = Object.freeze([
  { name: 'Side (from the left, front to the right)', right: [0, 1], up: [2, 1], toward: [1, 1] },
  { name: 'Top (front to the right, left side up)', right: [0, 1], up: [1, 1], toward: [2, 1] },
  { name: 'Front (from the front)', right: [1, 1], up: [2, 1], toward: [0, 1] },
  { name: 'Back (from behind)', right: [1, -1], up: [2, 1], toward: [0, -1] },
])

const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const formatNumber = (value: number): string => String(Number(value.toFixed(2)))

export const getBounds = (
  faces: ReferenceFaces,
  wheelMounts: readonly WheelMount[]
): ReferenceBounds => {
  const minimum = [0, 0, 0]
  const maximum = [0, 0, 0]
  for (let index = 0; index < faces.positions.length; index += 1) {
    const axis = index % 3
    const value = faces.positions[index] ?? 0
    minimum[axis] = Math.min(minimum[axis] ?? 0, value)
    maximum[axis] = Math.max(maximum[axis] ?? 0, value)
  }
  for (const mount of wheelMounts) {
    for (const axis of [0, 1, 2]) {
      const radius = AXIS_NAMES[axis] === mount.axle ? mount.width / 2 : mount.radius
      minimum[axis] = Math.min(minimum[axis] ?? 0, (mount.centre[axis] ?? 0) - radius)
      maximum[axis] = Math.max(maximum[axis] ?? 0, (mount.centre[axis] ?? 0) + radius)
    }
  }
  return {
    minimum: [minimum[0] ?? 0, minimum[1] ?? 0, minimum[2] ?? 0],
    maximum: [maximum[0] ?? 0, maximum[1] ?? 0, maximum[2] ?? 0],
  }
}

// The extent of the model alone (without the wheels), for the dimensions a builder needs.
export const getModelExtent = (faces: ReferenceFaces): readonly number[] => {
  const bounds = getBounds(faces, [])
  return [0, 1, 2].map((axis) => (bounds.maximum[axis] ?? 0) - (bounds.minimum[axis] ?? 0))
}

const getAxisRange = (bounds: ReferenceBounds, [axis, sign]: readonly [number, number]) => {
  const low = bounds.minimum[axis] ?? 0
  const high = bounds.maximum[axis] ?? 0
  return sign > 0
    ? ([Math.floor(low), Math.ceil(high)] as const)
    : ([-Math.ceil(high), -Math.floor(low)] as const)
}

const getPanelLines = (panel: Panel, scale: number, bounds: ReferenceBounds): readonly string[] => {
  const { view } = panel
  const [uLow, uHigh] = getAxisRange(bounds, view.right)
  const [vLow, vHigh] = getAxisRange(bounds, view.up)
  const getX = (u: number) => panel.left + (u - panel.uMinimum) * scale
  const getY = (v: number) => panel.top + (panel.vMaximum - v) * scale
  const lines: string[] = []
  for (let u = uLow; u <= uHigh; u += 1) {
    const value = u * view.right[1]
    const isMajor = value % MAJOR_GRID_STEP === 0
    lines.push(
      `<line x1="${formatNumber(getX(u))}" y1="${formatNumber(getY(vHigh))}" x2="${formatNumber(getX(u))}" y2="${formatNumber(getY(vLow))}" class="${isMajor ? 'major' : 'minor'}"/>`
    )
    if (isMajor) {
      lines.push(
        `<text x="${formatNumber(getX(u))}" y="${formatNumber(getY(vLow) + 12)}" class="tick" text-anchor="middle">${String(value)}</text>`
      )
    }
  }
  for (let v = vLow; v <= vHigh; v += 1) {
    const value = v * view.up[1]
    const isMajor = value % MAJOR_GRID_STEP === 0
    lines.push(
      `<line x1="${formatNumber(getX(uLow))}" y1="${formatNumber(getY(v))}" x2="${formatNumber(getX(uHigh))}" y2="${formatNumber(getY(v))}" class="${isMajor ? 'major' : 'minor'}"/>`
    )
    if (isMajor) {
      lines.push(
        `<text x="${formatNumber(getX(uLow) - 4)}" y="${formatNumber(getY(v) + 4)}" class="tick" text-anchor="end">${String(value)}</text>`
      )
    }
  }
  return lines
}

const LIGHT_DIRECTION = [0.35, 0.3, 0.88]
const AMBIENT_SHADE = 0.62

// A soft shade for a triangle, from its normal turned toward the viewer against a light from above and the front left.
const getShade = (corners: readonly (readonly number[])[], view: ReferenceView): number => {
  const [a = [], b = [], c = []] = corners
  const first = [0, 1, 2].map((axis) => (b[axis] ?? 0) - (a[axis] ?? 0))
  const second = [0, 1, 2].map((axis) => (c[axis] ?? 0) - (a[axis] ?? 0))
  const normal = [
    (first[1] ?? 0) * (second[2] ?? 0) - (first[2] ?? 0) * (second[1] ?? 0),
    (first[2] ?? 0) * (second[0] ?? 0) - (first[0] ?? 0) * (second[2] ?? 0),
    (first[0] ?? 0) * (second[1] ?? 0) - (first[1] ?? 0) * (second[0] ?? 0),
  ]
  const length = Math.hypot(...normal) || 1
  const facing = (normal[view.toward[0]] ?? 0) * view.toward[1] < 0 ? -1 : 1
  const lit = normal.reduce(
    (sum, value, axis) => sum + (value / length) * facing * (LIGHT_DIRECTION[axis] ?? 0),
    0
  )
  return AMBIENT_SHADE + (1 - AMBIENT_SHADE) * Math.max(0, lit)
}

const getPolygons = (panel: Panel, scale: number, faces: ReferenceFaces): readonly string[] => {
  const { view } = panel
  const triangleCount = faces.positions.length / 9
  const triangles = Array.from({ length: triangleCount }, (_unused, index) => {
    const corners = [0, 1, 2].map((corner) =>
      [0, 1, 2].map((axis) => faces.positions[index * 9 + corner * 3 + axis] ?? 0)
    )
    const depth =
      corners.reduce((sum, corner) => sum + (corner[view.toward[0]] ?? 0) * view.toward[1], 0) / 3
    return { index, corners, depth }
  })
  return triangles
    .sort((first, second) => first.depth - second.depth)
    .map(({ index, corners }) => {
      const points = corners
        .map((corner) => {
          const u = (corner[view.right[0]] ?? 0) * view.right[1]
          const v = (corner[view.up[0]] ?? 0) * view.up[1]
          return `${formatNumber(panel.left + (u - panel.uMinimum) * scale)},${formatNumber(panel.top + (panel.vMaximum - v) * scale)}`
        })
        .join(' ')
      const shade = getShade(corners, view)
      const [red, green, blue] = [0, 1, 2].map((channel) =>
        Math.round((faces.colors[index * 3 + channel] ?? 0) * shade)
      )
      return `<polygon points="${points}" fill="rgb(${String(red)},${String(green)},${String(blue)})"/>`
    })
}

const getWheelShapes = (
  panel: Panel,
  scale: number,
  mounts: readonly WheelMount[]
): readonly string[] => {
  const { view } = panel
  return mounts.map((mount) => {
    const u = (mount.centre[view.right[0]] ?? 0) * view.right[1]
    const v = (mount.centre[view.up[0]] ?? 0) * view.up[1]
    const axleAxis = AXIS_NAMES.indexOf(mount.axle)
    const x = panel.left + (u - panel.uMinimum) * scale
    const y = panel.top + (panel.vMaximum - v) * scale
    const isFacing = view.right[0] !== axleAxis && view.up[0] !== axleAxis
    return isFacing
      ? `<circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${formatNumber(mount.radius * scale)}" class="wheel"/>`
      : `<rect x="${formatNumber(x - (view.right[0] === axleAxis ? mount.width / 2 : mount.radius) * scale)}" y="${formatNumber(y - (view.up[0] === axleAxis ? mount.width / 2 : mount.radius) * scale)}" width="${formatNumber((view.right[0] === axleAxis ? mount.width : mount.radius * 2) * scale)}" height="${formatNumber((view.up[0] === axleAxis ? mount.width : mount.radius * 2) * scale)}" class="wheel"/>`
  })
}

const SEAT_RADIUS_PIXELS = 6

// The driver's seat: a green ring with a cross, in every view.
const getSeatMarker = (
  panel: Panel,
  scale: number,
  seat: readonly [number, number, number]
): string => {
  const { view } = panel
  const x = panel.left + ((seat[view.right[0]] ?? 0) * view.right[1] - panel.uMinimum) * scale
  const y = panel.top + (panel.vMaximum - (seat[view.up[0]] ?? 0) * view.up[1]) * scale
  const radius = SEAT_RADIUS_PIXELS
  return `<circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${formatNumber(radius)}" class="seat"/><path d="M${formatNumber(x - radius)},${formatNumber(y)}H${formatNumber(x + radius)}M${formatNumber(x)},${formatNumber(y - radius)}V${formatNumber(y + radius)}" class="seat"/>`
}

const getOrigin = (panel: Panel, scale: number): string => {
  const x = panel.left - panel.uMinimum * scale
  const y = panel.top + panel.vMaximum * scale
  return `<path d="M${formatNumber(x - 7)},${formatNumber(y)}H${formatNumber(x + 7)}M${formatNumber(x)},${formatNumber(y - 7)}V${formatNumber(y + 7)}" class="origin"/>`
}

// The sheet of a car or a chassis: four orthographic views of its triangles in the colours the game gives them, over a grid of studs
// in the car's frame (a line at every whole stud, labelled every 5; the origin is the red cross), the wheel mounts as blue outlines, the
// driver's seat as a green ring,
// then the dimensions, the colours as LDraw names and the notes.
export const createReferenceSheet = (content: ReferenceSheetContent): string => {
  const bounds = getBounds(content.faces, content.wheelMounts)
  const ranges = REFERENCE_VIEWS.map((view) => ({
    u: getAxisRange(bounds, view.right),
    v: getAxisRange(bounds, view.up),
  }))
  const widest = Math.max(...ranges.map(({ u }) => u[1] - u[0]))
  const tallest = Math.max(...ranges.map(({ v }) => v[1] - v[0]))
  const scale = Math.min(MAXIMUM_PIXELS_PER_STUD, MAXIMUM_PANEL_PIXELS / widest)
  const panelWidth = widest * scale
  const panelHeight = tallest * scale
  const columnWidth = panelWidth + MARGIN * 2
  const rowHeight = panelHeight + MARGIN * 2
  const headerHeight = MARGIN + LABEL_LINE * (content.lines.length + 1)
  const panels: readonly Panel[] = REFERENCE_VIEWS.map((view, index) => ({
    view,
    left: MARGIN + (index % 2) * columnWidth,
    top: headerHeight + MARGIN + Math.floor(index / 2) * rowHeight,
    width: ((ranges[index]?.u[1] ?? 0) - (ranges[index]?.u[0] ?? 0)) * scale,
    height: ((ranges[index]?.v[1] ?? 0) - (ranges[index]?.v[0] ?? 0)) * scale,
    uMinimum: ranges[index]?.u[0] ?? 0,
    vMaximum: ranges[index]?.v[1] ?? 0,
  }))
  const legendTop = headerHeight + rowHeight * 2 + MARGIN
  const width = columnWidth * 2 + MARGIN
  const height = legendTop + LABEL_LINE * (content.colorLines.length + 2)
  const body = panels.flatMap((panel) => [
    `<text x="${formatNumber(panel.left)}" y="${formatNumber(panel.top - 14)}" class="view">${escapeText(panel.view.name)}</text>`,
    ...getPanelLines(panel, scale, bounds),
    ...getPolygons(panel, scale, content.faces),
    ...getWheelShapes(panel, scale, content.wheelMounts),
    getSeatMarker(panel, scale, content.seat),
    getOrigin(panel, scale),
  ])
  const text = [
    `<text x="${formatNumber(MARGIN)}" y="${formatNumber(MARGIN)}" class="title">${escapeText(content.title)}</text>`,
    ...content.lines.map(
      (line, index) =>
        `<text x="${formatNumber(MARGIN)}" y="${formatNumber(MARGIN + LABEL_LINE * (index + 1))}" class="line">${escapeText(line)}</text>`
    ),
    `<text x="${formatNumber(MARGIN)}" y="${formatNumber(legendTop)}" class="view">Colours (LDraw names, share of the surface)</text>`,
    ...content.colorLines.flatMap(({ label, hex }, index) => [
      `<rect x="${formatNumber(MARGIN)}" y="${formatNumber(legendTop + LABEL_LINE * (index + 1) - 12)}" width="14" height="14" fill="${hex}" stroke="#000" stroke-width="0.5"/>`,
      `<text x="${formatNumber(MARGIN + 22)}" y="${formatNumber(legendTop + LABEL_LINE * (index + 1))}" class="line">${escapeText(label)}</text>`,
    ]),
  ]
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" font-family="Helvetica, Arial, sans-serif">`,
    '<style>.minor{stroke:#c9ced6;stroke-width:0.5}.major{stroke:#8a93a3;stroke-width:0.9}.tick{font-size:10px;fill:#4a5262}.view{font-size:13px;font-weight:bold;fill:#1d2330}.title{font-size:20px;font-weight:bold;fill:#1d2330}.line{font-size:13px;fill:#1d2330}.wheel{fill:none;stroke:#0055bf;stroke-width:1.6;stroke-dasharray:4 2}.origin{stroke:#d01012;stroke-width:2;fill:none}.seat{stroke:#00852b;stroke-width:2;fill:none}polygon{stroke:#222;stroke-width:0.25;stroke-linejoin:round}</style>',
    '<rect width="100%" height="100%" fill="#fff"/>',
    ...panels.map(
      (panel) =>
        `<rect x="${formatNumber(panel.left)}" y="${formatNumber(panel.top)}" width="${formatNumber(panel.width)}" height="${formatNumber(panel.height)}" fill="#f5f7fa"/>`
    ),
    ...body,
    ...text,
    '</svg>',
  ].join('\n')
}
