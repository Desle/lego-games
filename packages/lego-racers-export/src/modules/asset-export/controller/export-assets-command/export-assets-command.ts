import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { exportAssets } from '../export-assets/export-assets.ts'

const ALL_KINDS = ['textures', 'audio', 'video', 'models', 'worlds']
const MAXIMUM_LISTED_FAILURES = 10

// `pnpm run export-assets -- --game "<Game Files dir>" --out <dir> [--only textures,audio,video,models,worlds]`
const main = (): number => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== '--'),
    options: {
      game: { type: 'string' },
      out: { type: 'string' },
      only: { type: 'string' },
    },
  })
  if (values.game === undefined || values.out === undefined) {
    process.stderr.write(
      'Usage: pnpm run export-assets -- --game "<Game Files dir>" --out <dir> [--only textures,audio,video,models,worlds]\n'
    )
    return 1
  }
  const gameDirectory = resolve(values.game)
  if (!existsSync(join(gameDirectory, 'LEGO.JAM'))) {
    process.stderr.write(`LEGO.JAM was not found in ${gameDirectory}\n`)
    return 1
  }
  const { reports, manifest } = exportAssets(
    {
      gameDirectory,
      outputDirectory: resolve(values.out),
      exportedKinds: values.only === undefined ? ALL_KINDS : values.only.split(','),
    },
    (message) => process.stdout.write(`${message}\n`)
  )
  for (const report of reports) {
    process.stdout.write(
      `${report.label}: ${String(report.writtenCount)} exported, ${String(report.failures.length)} failed\n`
    )
    if (report.skipMessage !== null) process.stdout.write(`  skipped: ${report.skipMessage}\n`)
    for (const failure of report.failures.slice(0, MAXIMUM_LISTED_FAILURES)) {
      process.stdout.write(`  ${failure}\n`)
    }
  }
  process.stdout.write(
    `manifest.json lists ${String(manifest.entries.length)} files: ${JSON.stringify(manifest.countsByType)}\n`
  )
  return 0
}

process.exitCode = main()
