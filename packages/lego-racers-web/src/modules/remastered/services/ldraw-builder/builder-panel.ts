import type { LDrawColorName } from '../reference-kit/reference-kit.types.ts'
import { getPaletteGroups } from './builder-palette.ts'
import { ReferenceMode } from './builder-panel.types.ts'
import type {
  BuilderPanel,
  BuilderPanelElements,
  BuilderPanelHandlers,
  BuilderQueueView,
  BuilderToolView,
} from './builder-panel.types.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type { LibraryPart } from './ldraw-builder.types.ts'

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Click', 'place the part'],
  ['Shift + click', 'select a part'],
  ['R', 'rotate 90° (selected part, else the part in hand)'],
  ['Arrows, [ ]', 'move the selected part a stud, a plate down/up'],
  ['M', 'pick up the selected part to move it'],
  ['Q', 'take the part under the cursor (part, colour, turn)'],
  ['C or Alt + click', 'take the colour of the part under the cursor'],
  ['X', 'delete the part under the cursor'],
  ['Delete', 'delete the selected part'],
  ['Esc', 'deselect'],
  ['Ctrl/Cmd + Z, + Shift', 'undo, redo'],
  ['G', 'original: side by side, ghost, off'],
  ['W', 'wheel guides on/off'],
  ['F', 'frame the camera'],
  ['Drag, right drag, wheel', 'orbit, pan, zoom'],
]
const REFERENCE_LABELS: Readonly<Record<ReferenceMode, string>> = {
  [ReferenceMode.SIDE]: 'Original: side by side',
  [ReferenceMode.GHOST]: 'Original: ghost',
  [ReferenceMode.OFF]: 'Original: off',
}
const MODEL_FILE_LABEL = '(models folder file)'
const BYTE = 255

const createElement = <Name extends keyof HTMLElementTagNameMap>(
  name: Name,
  className: string,
  text = ''
): HTMLElementTagNameMap[Name] => {
  const element = document.createElement(name)
  element.className = className
  element.textContent = text
  return element
}

const createButton = (text: string, className: string, onClick: () => void) => {
  const button = createElement('button', className, text)
  button.type = 'button'
  button.addEventListener('click', onClick)
  return button
}

const getHex = (color: LDrawColorName): string =>
  `#${[color.red, color.green, color.blue].map((channel) => (channel & BYTE).toString(16).padStart(2, '0')).join('')}`

// The page's controls: the queue on the left, the bar over the views, the palette on the right and the shortcuts. They only show
// what the page gives them and hand every choice back.
export const createBuilderPanel = (
  elements: BuilderPanelElements,
  handlers: BuilderPanelHandlers
): BuilderPanel => {
  const { status } = elements
  const progress = createElement('div', 'progress')
  const queueList = createElement('ol', 'queue-list')
  elements.queue.append(progress, queueList)

  const title = createElement('strong', 'title')
  const startSelect = createElement('select', 'start')
  startSelect.title = 'Start from'
  startSelect.addEventListener('change', () =>
    handlers.onStartFileSelect(startSelect.value === '' ? null : startSelect.value)
  )
  const referenceSelect = createElement('select', 'reference')
  for (const mode of Object.values(ReferenceMode)) {
    referenceSelect.append(new Option(REFERENCE_LABELS[mode], mode))
  }
  referenceSelect.addEventListener('change', () =>
    handlers.onReferenceModeSelect(
      Object.values(ReferenceMode).find((mode) => mode === referenceSelect.value) ??
        ReferenceMode.SIDE
    )
  )
  const doneButton = createButton('Done ✓', 'done', handlers.onDone)
  doneButton.title = 'Save into the models folder, mark done, go to the next one'
  elements.bar.append(
    title,
    startSelect,
    referenceSelect,
    createButton('Undo', '', handlers.onUndo),
    createButton('Redo', '', handlers.onRedo),
    createButton('Rotate', '', handlers.onRotate),
    createButton('Delete', '', handlers.onDeleteSelected),
    doneButton
  )

  const tool = createElement('div', 'tool')
  const search = createElement('input', 'search')
  search.type = 'search'
  search.placeholder = 'Search parts: 3001, slope 45, wheel…'
  const partList = createElement('div', 'part-list')
  const colorGrid = createElement('div', 'color-grid')
  elements.palette.append(tool, search, partList, colorGrid)
  let libraryParts: readonly LibraryPart[] = []
  const showParts = () =>
    partList.replaceChildren(
      ...getPaletteGroups(libraryParts, search.value).flatMap((group) => [
        createElement('div', 'group', group.label),
        ...group.parts.map((part) => {
          const button = createButton(
            `${part.name.replace(/\.dat$/i, '')}  ${part.description}`,
            'part',
            () => handlers.onPartSelect(part.name)
          )
          button.title = part.description
          return button
        }),
      ])
    )
  search.addEventListener('input', showParts)

  const shortcutList = createElement('dl', 'shortcuts')
  for (const [keys, action] of SHORTCUTS) {
    shortcutList.append(createElement('dt', '', keys), createElement('dd', '', action))
  }
  elements.help.append(shortcutList)

  return {
    showQueue: (view: BuilderQueueView) => {
      const doneCount = view.items.filter((item) => view.done.includes(item.id)).length
      progress.textContent = `${String(doneCount)}/${String(view.items.length)} done`
      queueList.replaceChildren(
        ...view.items.map((item) => {
          const isDone = view.done.includes(item.id)
          const label =
            item.kind === BuilderItemKind.CHASSIS
              ? `Chassis ${item.name.toUpperCase()}`
              : `${item.name} on ${item.chassisName.toUpperCase()}`
          const row = createElement('li', item.id === view.currentId ? 'current' : '')
          row.append(
            createButton(`${isDone ? '✓' : '·'} ${label}`, isDone ? 'item done' : 'item', () =>
              handlers.onItemSelect(item.id)
            )
          )
          return row
        })
      )
      queueList.querySelector('.current')?.scrollIntoView({ block: 'nearest' })
    },
    showStartFiles: (files, selected) => {
      startSelect.replaceChildren(
        new Option(MODEL_FILE_LABEL, ''),
        ...files.map((file) => new Option(`Start from ${file}`, file))
      )
      startSelect.value = selected ?? ''
    },
    showReferenceMode: (mode) => {
      referenceSelect.value = mode
    },
    showLibrary: (parts) => {
      libraryParts = parts
      showParts()
    },
    showColors: (colors) =>
      colorGrid.replaceChildren(
        ...colors.map((color) => {
          const swatch = createButton('', 'swatch', () => handlers.onColorSelect(color.code))
          swatch.style.background = getHex(color)
          swatch.title = `${color.name} (${String(color.code)})`
          swatch.dataset['code'] = String(color.code)
          return swatch
        })
      ),
    showTool: (view: BuilderToolView) => {
      tool.textContent = `In hand: ${view.partName.replace(/\.dat$/i, '')} ${view.description} · ${view.colorName} (${String(view.colorCode)})`
      for (const swatch of colorGrid.querySelectorAll<HTMLElement>('.swatch')) {
        swatch.classList.toggle('chosen', swatch.dataset['code'] === String(view.colorCode))
      }
    },
    showStatus: (text) => {
      status.textContent = text
      title.textContent = text.split(' · ')[0] ?? ''
    },
    setIsBusy: (isBusy) => {
      doneButton.disabled = isBusy
    },
  }
}
