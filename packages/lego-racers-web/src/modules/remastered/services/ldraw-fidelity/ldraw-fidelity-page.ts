import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { ColorManagement, LinearSRGBColorSpace, WebGLRenderer } from 'three'
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { useLookFromAddress } from '@lego-games/ldraw/material'
import { loadLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { createDriverPair } from './fidelity-driver-pairs.ts'
import { listFidelityItems } from './fidelity-items.ts'
import { getFidelityResult, getUnmeasuredResult } from './fidelity-measurement.ts'
import { loadIndexWithCarFile } from './fidelity-model-index.ts'
import { createObjectPair } from './fidelity-pairs.ts'
import type { FidelityPairOutcome } from './fidelity-pairs.types.ts'
import { getVisibleBounds, prepareForMeasuring, renderPairViews } from './fidelity-render.ts'
import type { ViewPictures } from './fidelity-render.types.ts'
import { drawFidelitySheet } from './fidelity-sheet.ts'
import { FidelityItemKind } from './ldraw-fidelity.types.ts'
import type {
  FidelityItem,
  FidelityResult,
  FidelitySheetRequest,
  FidelityWindow,
} from './ldraw-fidelity.types.ts'
import { setUpLDrawModelParser } from '../ldraw-worker/ldraw-model-parser.ts'

// Pixels on a side of each view: a brick is about a tenth of an LDraw unit a pixel, a car about one.
const VIEW_SIZE = 200
const DRIVER_KINDS: readonly FidelityItemKind[] = [FidelityItemKind.DRIVER]

useLookFromAddress()
setUpLDrawModelParser()

const canvas = document.getElementById('stage')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('ldraw-fidelity.html has no canvas')
ColorManagement.enabled = false
// No antialiasing: a pixel is covered or not, the same on every run.
const renderer = new WebGLRenderer({ canvas, antialias: false })
renderer.outputColorSpace = LinearSRGBColorSpace

const archivePromise: Promise<JamArchive> = fetch(DEVELOPMENT_JAM_ROUTE)
  .then((response) => response.arrayBuffer())
  .then((buffer) => openJamArchive(new Uint8Array(buffer)))
const indexPromise = loadLDrawModelIndex()
const keptPictures = new Map<string, readonly ViewPictures[]>()

const getErrorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const createPair = async (item: FidelityItem): Promise<FidelityPairOutcome> => {
  const archive = await archivePromise
  await indexPromise
  if (item.kind === FidelityItemKind.CAR && item.file !== null) {
    await loadIndexWithCarFile(item.subject, item.file)
  }
  const context = { archive }
  return DRIVER_KINDS.includes(item.kind)
    ? createDriverPair(context, item)
    : createObjectPair(context, item)
}

// Builds the item's original and replacement, draws every view of both and turns the pictures into the item's numbers.
const measureFidelityItem = async (
  item: FidelityItem,
  isPictureKept: boolean
): Promise<FidelityResult> => {
  const outcome = await createPair(item).catch(
    (error: unknown) => `could not be built: ${getErrorText(error)}`
  )
  if (typeof outcome === 'string') return getUnmeasuredResult(item, outcome)
  try {
    prepareForMeasuring(outcome.pair.original)
    prepareForMeasuring(outcome.pair.replacement)
    const { focus } = outcome
    const originalBounds = focus?.original ?? getVisibleBounds(outcome.pair.original)
    const replacementBounds = focus?.replacement ?? getVisibleBounds(outcome.pair.replacement)
    if (originalBounds.isEmpty() || replacementBounds.isEmpty()) {
      return getUnmeasuredResult(item, 'one side draws nothing')
    }
    const pictures = renderPairViews(
      renderer,
      outcome.pair,
      VIEW_SIZE,
      focus === null ? null : originalBounds.clone().union(replacementBounds)
    )
    if (isPictureKept) keptPictures.set(item.id, pictures)
    return getFidelityResult(
      item,
      pictures,
      originalBounds,
      replacementBounds,
      outcome.anchors,
      outcome.chassis,
      outcome.note
    )
  } finally {
    outcome.dispose()
  }
}

const fidelityWindow: FidelityWindow = {
  listFidelityItems: async (draftFiles) =>
    listFidelityItems(await archivePromise, await indexPromise, draftFiles),
  measureFidelityItem,
  renderFidelitySheet: (rows: readonly FidelitySheetRequest[]) =>
    drawFidelitySheet(
      rows.flatMap((row) => {
        const pictures = keptPictures.get(row.id)
        return pictures === undefined ? [] : [{ label: row.label, pictures }]
      })
    ),
}

Object.assign(window, fidelityWindow)
