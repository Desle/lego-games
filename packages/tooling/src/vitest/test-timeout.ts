import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_TEST_TIMEOUT_IN_MILLISECONDS = 5_000
const ORIGINAL_FILES_TEST_TIMEOUT_IN_MILLISECONDS = 60_000

// Specs that read the original game only run where original-files/ exists (never in CI), and there they decode whole
// tracks and races while other work loads the machine; everywhere else the default keeps slow unit tests visible.
export const getTestTimeout = (repositoryRoot: string): number =>
  existsSync(resolve(repositoryRoot, 'original-files'))
    ? ORIGINAL_FILES_TEST_TIMEOUT_IN_MILLISECONDS
    : DEFAULT_TEST_TIMEOUT_IN_MILLISECONDS

// The settings every Node package's specs share.
export const getNodeTestOptions = (repositoryRoot: string) =>
  Object.freeze({
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    testTimeout: getTestTimeout(repositoryRoot),
  })
