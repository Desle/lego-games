import { describeReport, runDifferential } from './differential.ts'
import { getIsEmulatorAvailable, openEmulatorSession } from './emulator-client.ts'
import { createFloatSampler, createSeededRandom } from './seeded-random.ts'
import type { EmulatorPrecision } from './emulator-client.types.ts'
import type { DifferentialReport, DifferentialSuite } from './differential.types.ts'

const DEFAULT_CASE_COUNT = 3000
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

const getSeedFromName = (name: string): number =>
  Array.from(name, (character) => character.charCodeAt(0)).reduce(
    (seed, code) => (Math.imul(seed, 31) + code) >>> 0,
    7
  )

const getGeneratedInputs = (suite: DifferentialSuite): readonly (readonly number[])[] => {
  const sampler = createFloatSampler(createSeededRandom(getSeedFromName(suite.definition.name)))
  const generated = Array.from({ length: suite.caseCount ?? DEFAULT_CASE_COUNT }, () =>
    suite.generateInput(sampler)
  )
  // The original reads float32 memory, so every input is rounded to float32 for both sides.
  return [...(suite.fixedInputs ?? []), ...generated].map((input) => input.map(Math.fround))
}

const getReport = async (
  suite: DifferentialSuite,
  precision: EmulatorPrecision
): Promise<DifferentialReport> => {
  const session = openEmulatorSession()
  try {
    return await runDifferential(session, suite.definition, precision, getGeneratedInputs(suite))
  } finally {
    await session.close()
  }
}

const expectNoMismatches = async (
  suite: DifferentialSuite,
  precision: EmulatorPrecision
): Promise<void> => {
  // Arrange
  const expectedMismatchCount = 0

  // Act
  const report = await getReport(suite, precision)

  // Assert
  expect(report.mismatchCount, describeReport(report)).toBe(expectedMismatchCount)
}

const registerCases = (suite: DifferentialSuite) =>
  it.each(PRECISIONS)(
    'matches the original bit for bit in %s precision',
    (precision) => expectNoMismatches(suite, precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )

// Registers one vitest case per precision: the original code in the emulator against the port, bit for bit.
export const defineDifferentialSuite = (suite: DifferentialSuite) =>
  describe.skipIf(!getIsEmulatorAvailable())(`${suite.definition.name} against the original`, () =>
    registerCases(suite)
  )
