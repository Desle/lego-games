import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import { getCoverageRaces, runRenderCoverage } from './render-coverage.ts'
import {
  createCoverageReport,
  formatCoverageReport,
  readCoverageFiles,
} from './render-coverage-report.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

const INTERVAL_FRAMES = Number(process.env['RENDER_COVERAGE_INTERVAL'] ?? '90')
const MAXIMUM_FRAMES = Number(process.env['RENDER_COVERAGE_MAXIMUM'] ?? '6000')
const OUTPUT_DIRECTORY = resolve(
  process.env['RENDER_COVERAGE_OUTPUT'] ??
    resolve(import.meta.dirname, '../../../../../.render-coverage')
)
const SELECTED_RACES = (process.env['RENDER_COVERAGE_RACES'] ?? '')
  .split(',')
  .filter((name) => name !== '')

// One race per run of the test: `RENDER_COVERAGE_RACES=rkr,igp2` limits the sweep to those catalog names, the output
// folder (`RENDER_COVERAGE_OUTPUT`) gets one JSON file per race; docs: render-coverage.md.
describe.skipIf(!isGamePresent())('render coverage', () => {
  const races = isGamePresent()
    ? getCoverageRaces(readOriginalJam()).filter(
        (race) => SELECTED_RACES.length === 0 || SELECTED_RACES.includes(race.catalogName)
      )
    : []

  it.each(races)('sweeps $catalogName', async (race) => {
    // Arrange
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true })

    // Act
    const coverage = await runRenderCoverage(race, {
      intervalFrames: INTERVAL_FRAMES,
      maximumFrames: MAXIMUM_FRAMES,
    })
    writeFileSync(
      resolve(OUTPUT_DIRECTORY, `${race.catalogName}.json`),
      JSON.stringify(coverage, null, 1)
    )

    // Assert
    expect(coverage.frames.length).toBe(coverage.recordedFrames.length)
  })

  it('writes the ranked summary of every race in the output folder', () => {
    // Arrange
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true })

    // Act
    const report = createCoverageReport(readCoverageFiles(OUTPUT_DIRECTORY))
    writeFileSync(resolve(OUTPUT_DIRECTORY, 'summary.md'), formatCoverageReport(report, 60))

    // Assert
    expect(report.races.length).toBeGreaterThanOrEqual(0)
  })
})
