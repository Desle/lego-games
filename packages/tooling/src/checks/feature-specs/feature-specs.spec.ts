import {
  findModulesWithoutSpecs,
  findSpecStructureProblems,
  getDeclaredEndpoints,
  getRegisteredEndpoints,
} from './feature-specs.ts'

describe('feature specs', () => {
  it('flags missing and unfilled sections', () => {
    // Arrange
    const markdown = ['## Behaviour', 'Returns invoices.', '## User flows', '_Step by step_'].join(
      '\n'
    )

    // Act
    const problems = findSpecStructureProblems('invoices.md', markdown, [
      'Behaviour',
      'User flows',
      'Invariants',
    ])

    // Assert
    expect(problems.map((problem) => problem.message)).toEqual([
      "section '## User flows' is still the template placeholder",
      "missing section '## Invariants'",
    ])
  })

  it('reads declared endpoints only from the Endpoints section', () => {
    // Arrange
    const markdown = [
      '## Behaviour',
      '- `GET /not-an-endpoint`',
      '## Endpoints',
      '- `GET /invoices`',
      '- `POST /invoices/:id`',
    ].join('\n')

    // Act
    const endpoints = getDeclaredEndpoints(markdown)

    // Assert
    expect(endpoints).toEqual(['GET /invoices', 'POST /invoices/:id'])
  })

  it('reads routes registered with string literals, ignoring tests', () => {
    // Arrange
    const files = new Map([
      [
        'src/router.ts',
        "router.get('/invoices', onList)\napplication.post(`/invoices`, onCreate)\nmap.get(key)",
      ],
      ['src/router.spec.ts', "router.delete('/invoices', onDelete)"],
    ])

    // Act
    const registered = getRegisteredEndpoints(files)

    // Assert
    expect([...registered]).toEqual(['GET /invoices', 'POST /invoices'])
  })

  it('flags modules that have no spec, and ignores loose files under modules/', () => {
    // Arrange
    const sourceFiles = [
      'src/modules/billing/index.ts',
      'src/modules/billing/types/invoice.types.ts',
      'src/modules/notes/index.ts',
      'src/modules/README.md',
      'src/shared/environment/environment.ts',
    ]
    const specPaths = ['.docs/specs/notes.md']

    // Act
    const problems = findModulesWithoutSpecs(sourceFiles, 'src', specPaths, '.docs/specs')

    // Assert
    expect(problems.map((problem) => `${problem.path}: ${problem.message}`)).toEqual([
      'src/modules/billing: has no spec; write .docs/specs/billing.md (pnpm run new:module scaffolds one)',
    ])
  })
})
