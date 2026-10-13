import type { LDrawColorName } from '../reference-kit/reference-kit.types.ts'
import { getPaletteGroups } from './builder-palette.ts'
import { BUILDER_SHORTCUT_GROUPS, BUILDER_SHORTCUT_HINTS } from './builder-shortcuts.ts'
import { ReferenceMode } from './builder-panel.types.ts'
import type {
  BuilderPanel,
  BuilderPanelElements,
  BuilderPanelHandlers,
  BuilderQueueView,
  BuilderToolView,
} from './builder-panel.types.ts'
import { EMPTY_START_FILE } from './ldraw-builder-route.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type { LibraryPart } from './ldraw-builder.types.ts'

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
  doneButton.title = 'Save into the models folder, mark done, go to the next one (⌘S)'
  const shortcutsButton = createButton('?', 'shortcuts-button', handlers.onShortcutsToggle)
  shortcutsButton.title = 'Shortcuts (?)'
  elements.bar.append(
    title,
    startSelect,
    referenceSelect,
    createButton('Undo', '', handlers.onUndo),
    createButton('Redo', '', handlers.onRedo),
    createButton('Rotate', '', handlers.onRotate),
    createButton('Delete', '', handlers.onDeleteSelected),
    shortcutsButton,
    doneButton
  )

  const tool = createElement('div', 'tool')
  const search = createElement('input', 'search')
  search.type = 'search'
  search.placeholder = 'Search parts: 3001, slope 45, wheel…'
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') search.blur()
  })
  const tabs = createElement('div', 'tabs')
  const partList = createElement('div', 'part-list')
  const colorGrid = createElement('div', 'color-grid')
  elements.palette.append(tool, search, tabs, partList, colorGrid)
  let libraryParts: readonly LibraryPart[] = []
  let activeLabel = ''
  let colorCode = 0
  let chosenPartName = ''
  const thumbnailObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const image = entry.target
        if (!entry.isIntersecting || !(image instanceof HTMLImageElement)) continue
        thumbnailObserver.unobserve(image)
        const partName = image.dataset['part'] ?? ''
        const wantedColor = colorCode
        void handlers.getThumbnail(partName, wantedColor).then((url) => {
          if (url !== null && image.dataset['color'] === String(wantedColor)) image.src = url
        })
      }
    },
    { root: partList, rootMargin: '64px' }
  )
  const createTile = (part: LibraryPart) => {
    const number = part.name.replace(/\.dat$/i, '')
    const tile = createButton('', 'tile', () => handlers.onPartSelect(part.name))
    tile.title = `${number}  ${part.description}`
    tile.dataset['part'] = part.name.toLowerCase()
    tile.classList.toggle('chosen', part.name.toLowerCase() === chosenPartName)
    const image = createElement('img', 'thumbnail')
    image.alt = ''
    image.dataset['part'] = part.name
    image.dataset['color'] = String(colorCode)
    thumbnailObserver.observe(image)
    tile.append(image, createElement('span', 'number', number))
    return tile
  }
  const showParts = () => {
    thumbnailObserver.disconnect()
    const isSearching = search.value.trim() !== ''
    const groups = getPaletteGroups(libraryParts, search.value)
    if (!groups.some((group) => group.label === activeLabel)) activeLabel = groups[0]?.label ?? ''
    tabs.replaceChildren(
      ...(isSearching
        ? []
        : groups.map((group) =>
            createButton(group.label, group.label === activeLabel ? 'tab active' : 'tab', () => {
              activeLabel = group.label
              showParts()
            })
          ))
    )
    const shown = isSearching ? groups : groups.filter((group) => group.label === activeLabel)
    partList.replaceChildren(
      ...shown.flatMap((group) => [
        ...(isSearching ? [createElement('div', 'group', group.label)] : []),
        createElement('div', 'tiles'),
      ])
    )
    const grids = partList.querySelectorAll('.tiles')
    shown.forEach((group, index) => grids[index]?.append(...group.parts.map(createTile)))
  }
  search.addEventListener('input', showParts)

  const hintLines = BUILDER_SHORTCUT_HINTS.map((line) => createElement('div', 'hint', line))
  const modeLine = createElement('div', 'mode')
  elements.help.append(modeLine, ...hintLines)
  const overlay = elements.shortcuts
  overlay.hidden = true
  overlay.append(
    createElement('h2', '', 'Shortcuts'),
    ...BUILDER_SHORTCUT_GROUPS.map((group) => {
      const section = createElement('section', '')
      const list = createElement('dl', '')
      for (const shortcut of group.shortcuts) {
        list.append(
          createElement('dt', '', shortcut.keys),
          createElement('dd', '', shortcut.description)
        )
      }
      section.append(createElement('h3', '', group.title), list)
      return section
    }),
    createElement('p', 'close', '? or ⎋ to close')
  )

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
        new Option('Start empty', EMPTY_START_FILE),
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
      tool.textContent = view.isHolding
        ? `In hand: ${view.partName.replace(/\.dat$/i, '')} ${view.description} · ${view.colorName}`
        : `Empty hand · ${view.colorName}: pick a part`
      const nextPartName = view.isHolding ? view.partName.toLowerCase() : ''
      const isColorChanged = view.colorCode !== colorCode
      colorCode = view.colorCode
      if (isColorChanged) {
        showParts()
      } else if (nextPartName !== chosenPartName) {
        for (const tile of partList.querySelectorAll<HTMLElement>('.tile')) {
          tile.classList.toggle('chosen', tile.dataset['part'] === nextPartName)
        }
      }
      chosenPartName = nextPartName
      for (const swatch of colorGrid.querySelectorAll<HTMLElement>('.swatch')) {
        swatch.classList.toggle('chosen', swatch.dataset['code'] === String(view.colorCode))
      }
    },
    showStatus: (text) => {
      status.textContent = text
      title.textContent = text.split(' · ')[0] ?? ''
    },
    showHint: (text) => {
      modeLine.textContent = text
    },
    setIsShortcutsShown: (isShown) => {
      overlay.hidden = !isShown
    },
    getIsShortcutsShown: () => !overlay.hidden,
    setIsBusy: (isBusy) => {
      doneButton.disabled = isBusy
    },
  }
}
