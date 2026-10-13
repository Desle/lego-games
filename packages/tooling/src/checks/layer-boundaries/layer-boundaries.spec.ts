import { DEFAULT_CONFIG } from '../../config/resolve-config/resolve-config.ts'
import { findLayerViolations, resolveByPath } from './layer-boundaries.ts'

const check = (files: Record<string, string>) =>
  findLayerViolations(new Map(Object.entries(files)), DEFAULT_CONFIG, resolveByPath).map(
    (violation) => `${violation.path}: ${violation.message}`
  )

describe('findLayerViolations', () => {
  it('catches each kind of violation', () => {
    // Arrange
    const files = {
      'src/modules/billing/transport/invoice-router.ts':
        "import { saveInvoice } from '../services/invoice-service.ts'",
      'src/modules/billing/types/invoice.types.ts': "import { z } from 'zod'",
      'src/modules/billing/controller/pay.ts':
        "import { getUser } from '../../users/services/user-service.ts'",
      'src/shared/format.ts': "import { pay } from '../modules/billing/index.ts'",
      'src/modules/billing/helpers/round.ts': "import { x } from '../types/money.types.ts'",
      'src/modules/billing/loose.ts': "export const x = await import('./types/money.types.ts')",
      'src/modules/billing/services/repository.ts': "import { main } from '../../../main.ts'",
    }

    // Act
    const violations = check(files)

    // Assert
    expect(violations).toEqual([
      'src/modules/billing/transport/invoice-router.ts: the transport layer may not import the services layer (allowed: controller, types)',
      "src/modules/billing/types/invoice.types.ts: the types layer must stay framework-free, but imports 'zod'",
      'src/modules/billing/controller/pay.ts: import modules/users through its index.ts, not its internals',
      'src/shared/format.ts: shared code must not import from modules',
      "src/modules/billing/helpers/round.ts: unknown layer folder 'helpers' — use one of: types, events, services, controller, transport, views, components, providers",
      'src/modules/billing/loose.ts: only index.ts may sit at the root of modules/billing; move this file into a layer folder',
      'src/modules/billing/services/repository.ts: only the composition root may import src/main.ts; if that folder is shared UI or utilities, add it to sharedDirectories in tooling.config.ts',
    ])
  })

  it('allows the intended dependency directions', () => {
    // Arrange
    const files = {
      'src/modules/billing/transport/invoice-router.ts':
        "import { pay } from '../controller/pay.ts'\nimport type { Invoice } from '../types/invoice.types.ts'",
      'src/modules/billing/controller/pay.ts':
        "import { getUser } from '../../users/index.ts'\nimport { x } from '../../users'",
      'src/modules/billing/services/invoice-service.ts':
        "import type { Invoice } from '../types/invoice.types.ts'\nimport { readFile } from 'node:fs'",
      'src/modules/billing/index.ts': "export { router } from './transport/invoice-router.ts'",
      'src/modules/billing/types/money.types.ts':
        "import { createEnum } from '../../../shared/types/enum.types.ts'",
      'src/main.ts': "import { router } from './modules/billing/index.ts'",
      'src/modules/billing/views/invoice-view.tsx':
        "import { Button } from '../components/button.tsx'",
    }

    // Act
    const violations = check(files)

    // Assert
    expect(violations).toEqual([])
  })

  it('lets every layer import configured shared directories, and components use controllers and providers', () => {
    // Arrange
    const files = {
      'src/modules/billing/components/invoice-card.tsx':
        "import { Button } from '../../../components/ui/button.tsx'\nimport { useInvoice } from '../controller/use-invoice-controller.ts'\nimport { useSession } from '../providers/session.context.ts'",
      'src/components/ui/button.tsx':
        "import { mergeClassNames } from '../../shared/utils/merge-class-names.ts'",
    }
    const rules = { ...DEFAULT_CONFIG, sharedDirectories: ['shared', 'components'] }

    // Act
    const violations = findLayerViolations(new Map(Object.entries(files)), rules, resolveByPath)

    // Assert
    expect(violations).toEqual([])
  })

  it('keeps a package off its forbidden imports and out of other packages', () => {
    // Arrange
    const files = {
      'src/modules/geometry/services/merge.ts':
        "import { loadModelScene } from '@lego-games/lego-racers/scene'\nimport { Group } from 'three'",
      'src/modules/geometry/services/parse.ts':
        "import { takeWheels } from '../../../../../lego-racers-web/src/parts.ts'",
      'src/modules/geometry/index.ts': "export { merge } from './services/merge.ts'",
    }
    const rules = { ...DEFAULT_CONFIG, forbiddenImports: ['@lego-games/lego-racers'] }

    // Act
    const violations = findLayerViolations(
      new Map(Object.entries(files)),
      rules,
      resolveByPath
    ).map((violation) => `${violation.path}: ${violation.message}`)

    // Assert
    expect(violations).toEqual([
      "src/modules/geometry/services/merge.ts: this package must never import '@lego-games/lego-racers/scene' (forbiddenImports in tooling.config.ts)",
      "src/modules/geometry/services/parse.ts: '../../../../../lego-racers-web/src/parts.ts' reaches outside this package; import the other package by its name",
    ])
  })

  it('honours a reasoned escape hatch', () => {
    // Arrange
    const files = {
      'src/modules/billing/transport/router.ts':
        "// @check-allow layer-boundaries: health probe reads the pool directly\nimport { pool } from '../services/pool.ts'",
    }

    // Act
    const violations = check(files)

    // Assert
    expect(violations).toEqual([])
  })
})
