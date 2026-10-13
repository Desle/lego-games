import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getOrCreate } from './render-coverage.ts'
import type {
  CoverageRankedExtra,
  CoverageRankedMismatch,
  CoverageRankedTexture,
  CoverageReport,
} from './render-coverage-report.types.ts'
import type { CoverageBounds, CoverageTextureRow, RaceCoverage } from './render-coverage.types.ts'

const NAME_LIMIT = 70
const RACE_LIMIT = 6

const getMergedBounds = (left: CoverageBounds | null, right: CoverageBounds | null) =>
  left == null || right == null
    ? (left ?? right ?? null)
    : {
        left: Math.min(left.left, right.left),
        top: Math.min(left.top, right.top),
        right: Math.max(left.right, right.right),
        bottom: Math.max(left.bottom, right.bottom),
      }

const getMergedDepthRange = (
  left: readonly [number, number] | null,
  right: readonly [number, number] | null
): readonly [number, number] | null =>
  left == null || right == null
    ? (left ?? right ?? null)
    : [Math.min(left[0], right[0]), Math.max(left[1], right[1])]

export const readCoverageFiles = (directory: string): readonly RaceCoverage[] =>
  readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as RaceCoverage)

// The textures, port objects and mismatches of every race, merged by name and ranked by what the player would miss.
export const createCoverageReport = (races: readonly RaceCoverage[]): CoverageReport => {
  const textures = new Map<string, CoverageRankedTexture>()
  const extras = new Map<string, CoverageRankedExtra>()
  const mismatches = new Map<string, CoverageRankedMismatch>()
  for (const coverage of races) {
    const raceName = coverage.race.catalogName
    for (const row of coverage.textures) {
      const known = getOrCreate(textures, `${row.textureName}|${row.stateLabel}`, () => ({
        textureName: row.textureName,
        stateLabel: row.stateLabel,
        isTextureInPort: row.isTextureInPort,
        isNeverDrawnByPort: true,
        originalTriangles: 0,
        missingTriangles: 0,
        clippedTriangles: 0,
        missingPixels: 0,
        frameCount: 0,
        races: [] as readonly string[],
        bounds: null as CoverageBounds | null,
        depthRange: null as readonly [number, number] | null,
      }))
      textures.set(`${row.textureName}|${row.stateLabel}`, {
        ...known,
        isNeverDrawnByPort: known.isNeverDrawnByPort && row.portSources.length === 0,
        originalTriangles: known.originalTriangles + row.originalTriangles,
        missingTriangles: known.missingTriangles + row.missingTriangles,
        clippedTriangles: known.clippedTriangles + row.clippedTriangles,
        missingPixels: known.missingPixels + row.missingPixels,
        frameCount: known.frameCount + row.missingFrames.length,
        races: row.missingTriangles > 0 ? [...known.races, raceName] : known.races,
        bounds: getMergedBounds(known.bounds, row.missingBounds),
        depthRange: getMergedDepthRange(known.depthRange, row.missingDepthRange),
      })
    }
    for (const row of coverage.extras) {
      const key = `${row.source}|${row.textureName}`
      const known = getOrCreate(extras, key, () => ({
        source: row.source,
        textureName: row.textureName,
        triangles: 0,
        frameCount: 0,
        races: [] as readonly string[],
      }))
      extras.set(key, {
        ...known,
        triangles: known.triangles + row.triangles,
        frameCount: known.frameCount + row.frames.length,
        races: [...known.races, raceName],
      })
    }
    for (const row of coverage.mismatches) {
      const key = `${row.kind}|${row.source}`
      const known = getOrCreate(mismatches, key, () => ({
        kind: row.kind,
        source: row.source,
        triangles: 0,
        frameCount: 0,
        races: [] as readonly string[],
        firstDetail: row.firstDetail,
        lastDetail: row.lastDetail,
      }))
      mismatches.set(key, {
        ...known,
        triangles: known.triangles + row.triangles,
        frameCount: known.frameCount + row.frames.length,
        races: [...known.races, raceName],
        lastDetail: row.lastDetail,
      })
    }
  }
  return Object.freeze({
    races,
    textures: [...textures.values()].sort(
      (left, right) => right.missingPixels - left.missingPixels
    ),
    extras: [...extras.values()].sort((left, right) => right.triangles - left.triangles),
    mismatches: [...mismatches.values()].sort((left, right) => right.triangles - left.triangles),
  })
}

const getRaceList = (races: readonly string[]): string => {
  const unique = [...new Set(races)]
  return unique.length > RACE_LIMIT
    ? `${unique.slice(0, RACE_LIMIT).join(' ')} +${String(unique.length - RACE_LIMIT)}`
    : unique.join(' ')
}

const getShortName = (name: string): string =>
  name.length > NAME_LIMIT ? `${name.slice(0, NAME_LIMIT)}...` : name

// The ranked tables as markdown, ready for render-coverage.md.
export const formatCoverageReport = (report: CoverageReport, rowLimit: number): string =>
  [
    '## Races',
    '',
    '| Race | Folder | Mirrored | Lap end frame | Finish frame | Recorded | Untrusted | Mean share matched | Lowest |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.races.map((coverage) => {
      const shares = coverage.frames
        .filter((frame) => frame.isTrusted)
        .map((frame) => frame.matchedCount / frame.originalCount)
      const mean = shares.reduce((total, share) => total + share, 0) / shares.length
      return `| ${coverage.race.catalogName} | ${coverage.race.raceFolder} | ${String(coverage.race.isMirrored)} | ${String(coverage.probe.lapEndFrame)} | ${String(coverage.probe.finishFrame)} | ${String(coverage.recordedFrames.length)} | ${String(coverage.frames.filter((frame) => !frame.isTrusted).length)} | ${mean.toFixed(3)} | ${Math.min(...shares).toFixed(3)} |`
    }),
    '',
    '## Triangles per race (trusted frames)',
    '',
    '| Race | Original | Cut pieces with a parent in the port | Unmatched | Port only |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.races.map((coverage) => {
      const sum = (getValue: (row: CoverageTextureRow) => number) =>
        coverage.textures.reduce((total, row) => total + getValue(row), 0)
      const portOnly = coverage.extras.reduce((total, row) => total + row.triangles, 0)
      return `| ${coverage.race.catalogName} | ${String(sum((row) => row.originalTriangles))} | ${String(sum((row) => row.clippedTriangles))} | ${String(sum((row) => row.missingTriangles))} | ${String(portOnly)} |`
    }),
    '',
    '## Original textures without a partner (ranked by screen pixels)',
    '',
    '| Texture | State | In port | Never drawn | Missing / drawn triangles | Pixels | Frames | Screen box | Depth | Races |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
    ...report.textures
      .slice(0, rowLimit)
      .map(
        (row) =>
          `| ${getShortName(row.textureName)} | ${row.stateLabel} | ${String(row.isTextureInPort)} | ${String(row.isNeverDrawnByPort)} | ${String(row.missingTriangles)} / ${String(row.originalTriangles)} | ${String(row.missingPixels)} | ${String(row.frameCount)} | ${row.bounds === null ? '' : `${String(row.bounds.left)},${String(row.bounds.top)}-${String(row.bounds.right)},${String(row.bounds.bottom)}`} | ${row.depthRange === null ? '' : `${row.depthRange[0].toFixed(1)}-${row.depthRange[1].toFixed(1)}`} | ${getRaceList(row.races)} |`
      ),
    '',
    '## Port objects the original does not draw (ranked by triangles)',
    '',
    '| Port object | Texture | Triangles | Frames | Races |',
    '| --- | --- | ---: | ---: | --- |',
    ...report.extras
      .slice(0, rowLimit)
      .map(
        (row) =>
          `| ${getShortName(row.source)} | ${getShortName(row.textureName)} | ${String(row.triangles)} | ${String(row.frameCount)} | ${getRaceList(row.races)} |`
      ),
    '',
    '## Drawn by both, differently (texture, picture coordinates, colour, state)',
    '',
    '| Kind | Port object | Triangles | Frames | First | Last | Races |',
    '| --- | --- | ---: | ---: | --- | --- | --- |',
    ...report.mismatches
      .slice(0, rowLimit)
      .map(
        (row) =>
          `| ${row.kind} | ${getShortName(row.source)} | ${String(row.triangles)} | ${String(row.frameCount)} | ${row.firstDetail} | ${row.lastDetail} | ${getRaceList(row.races)} |`
      ),
  ].join('\n')
