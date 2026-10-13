import { FIDELITY_PASS_SCORE } from './fidelity-metrics.ts'
import { FidelityItemKind } from './ldraw-fidelity.types.ts'
import type { FidelityResult } from './ldraw-fidelity.types.ts'

const WORST_ROW_COUNT = 100
const MINIMUM_SEPARATOR_WIDTH = 3

const getText = (value: number | null, digits = 2): string =>
  value === null ? '' : value.toFixed(digits)

// Worst first; equal scores by id, so the order is the same on every run.
export const getSortedResults = (results: readonly FidelityResult[]): readonly FidelityResult[] =>
  [...results].sort(
    (first, second) => first.score - second.score || first.id.localeCompare(second.id)
  )

// The results of a run merged into those of earlier runs: a run of some items replaces those and keeps the others.
export const mergeResults = (
  previous: readonly FidelityResult[],
  fresh: readonly FidelityResult[]
): readonly FidelityResult[] => {
  const freshIds = new Set(fresh.map((result) => result.id))
  return getSortedResults([...previous.filter((result) => !freshIds.has(result.id)), ...fresh])
}

const getCell = (text: string): string => text.replaceAll('|', '\\|')

// A Markdown table laid out as Prettier lays it out (every column padded to its widest cell), so the generated page passes the format
// check as written.
export const createMarkdownTable = (
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string => {
  const cells = [headers, ...rows].map((row) => row.map(getCell))
  const widths = headers.map((_header, column) =>
    Math.max(MINIMUM_SEPARATOR_WIDTH, ...cells.map((row) => (row[column] ?? '').length))
  )
  const getLine = (row: readonly string[]) =>
    `| ${widths.map((width, column) => (row[column] ?? '').padEnd(width)).join(' | ')} |`
  const [headerRow = [], ...bodyRows] = cells
  return [
    getLine(headerRow),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...bodyRows.map(getLine),
  ].join('\n')
}

const getSummaryRows = (results: readonly FidelityResult[]): readonly (readonly string[])[] =>
  Object.values(FidelityItemKind).flatMap((kind) => {
    const ofKind = results.filter((result) => result.kind === kind)
    if (ofKind.length === 0) return []
    const passed = ofKind.filter((result) => result.isPassed).length
    const mean = ofKind.reduce((sum, result) => sum + result.score, 0) / ofKind.length
    const worst = getSortedResults(ofKind)[0]
    return [
      [
        kind,
        String(ofKind.length),
        String(passed),
        mean.toFixed(1),
        worst === undefined ? '' : `${worst.name} (${worst.score.toFixed(1)})`,
      ],
    ]
  })

const getResultRow = (result: FidelityResult): readonly string[] => [
  result.score.toFixed(1),
  result.isPassed ? 'pass' : 'fail',
  `\`${result.id}\``,
  `${result.meanIntersectionOverUnion.toFixed(3)} (${result.minimumIntersectionOverUnion.toFixed(3)})`,
  result.centroidOffset.map((value) => value.toFixed(1)).join(' / '),
  result.scaleRatio.toFixed(3),
  getText(result.meanColorDifference, 1),
  result.anchors.length === 0
    ? ''
    : result.anchors.map((anchor) => `${anchor.name} ${anchor.distance.toFixed(1)}`).join(', '),
  [
    result.footprintCoverage === null
      ? ''
      : `cells on studs ${(result.footprintCoverage * 100).toFixed(0)} %`,
    result.note,
  ]
    .filter((text) => text !== '')
    .join('; '),
]

// The page of the scores (`.docs/remastered-ldraw-fidelity.md`): how many of each kind pass, and the worst items.
export const createFidelityReport = (results: readonly FidelityResult[]): string => {
  const sorted = getSortedResults(results)
  const passed = sorted.filter((result) => result.isPassed).length
  return [
    '# LDraw fidelity scores',
    '',
    `Written by \`pnpm run ldraw-fidelity\`; do not edit. How it measures and how to use it: [remastered.md](remastered.md#judging-ldraw-work). A replacement passes at a score of ${String(FIDELITY_PASS_SCORE)} or more. ${String(passed)} of ${String(sorted.length)} items pass. Every item, with each view and attachment point, is in \`reverse-engineering/ldraw-fidelity/fidelity.json\` (not committed).`,
    '',
    '## By kind',
    '',
    createMarkdownTable(['Kind', 'Items', 'Passed', 'Mean score', 'Worst'], getSummaryRows(sorted)),
    '',
    `## The ${String(Math.min(WORST_ROW_COUNT, sorted.length))} worst`,
    '',
    'IoU: silhouette overlap, the mean of the four views (the worst view). Offset: the centre of area of the replacement from the original, LDraw units, x forward, y left, z up. Scale: the size of the bounds, replacement over original. ΔE: the mean CIE76 colour difference where both cover. Anchors: attachment points, LDraw units.',
    '',
    createMarkdownTable(
      ['Score', 'Result', 'Item', 'IoU', 'Offset x / y / z', 'Scale', 'ΔE', 'Anchors', 'Note'],
      sorted.slice(0, WORST_ROW_COUNT).map(getResultRow)
    ),
    '',
  ].join('\n')
}

// One item's numbers for the terminal, when only a few are measured.
export const getResultDetails = (result: FidelityResult): string =>
  [
    `${result.id}: ${result.score.toFixed(1)} ${result.isPassed ? 'pass' : 'FAIL'}${result.note === '' ? '' : ` (${result.note})`}`,
    `  views: ${result.views.map((view) => `${view.view} IoU ${view.intersectionOverUnion.toFixed(3)} ΔE ${getText(view.colorDifference, 1)}`).join('; ')}`,
    `  centroid offset ${result.centroidOffset.join(' / ')} LDU, bounds centre offset ${result.boundsCentreOffset.join(' / ')} LDU, size ratio ${result.sizeRatio.join(' / ')}`,
    ...(result.footprintCoverage === null
      ? []
      : [`  building cells on a stud: ${(result.footprintCoverage * 100).toFixed(0)} %`]),
    `  anchors: ${result.anchors.map((anchor) => `${anchor.name} ${anchor.distance.toFixed(2)}`).join(', ') || 'none'}`,
  ].join('\n')
