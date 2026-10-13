import { LOOK_APPEARANCES, LookPreset, getLookPreset } from '@lego-games/ldraw/material'
import { createModelsTabController } from '../../controller/models-tab/models-tab-controller.ts'
import type { ModelFolder } from '../../types/studio.types.ts'

const TAB_NAMES: readonly string[] = ['Models']
const LOOK_PRESETS: readonly LookPreset[] = Object.values(LookPreset)

const createElement = <Name extends keyof HTMLElementTagNameMap>(
  name: Name,
  className: string
): HTMLElementTagNameMap[Name] => {
  const element = document.createElement(name)
  element.className = className
  return element
}

const createTabList = (): HTMLElement => {
  const tabList = createElement('nav', 'tabs')
  tabList.setAttribute('role', 'tablist')
  tabList.append(
    ...TAB_NAMES.map((name, index) => {
      const tab = createElement('button', 'tab')
      tab.type = 'button'
      tab.textContent = name
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(index === 0))
      return tab
    })
  )
  return tabList
}

const fillModelSelect = (
  select: HTMLSelectElement,
  folders: readonly ModelFolder[],
  selectedPath: string | null
) =>
  select.replaceChildren(
    ...folders.map(({ folder, files }) => {
      const group = document.createElement('optgroup')
      group.label = folder
      group.append(
        ...files.map((file) => new Option(file.name, file.path, false, file.path === selectedPath))
      )
      return group
    })
  )

// The studio: a tab list (Models for now), and the Models tab's picker and look over the editor's model viewer.
export const mountStudioPage = (root: HTMLElement) => {
  const bar = createElement('div', 'bar')
  const modelSelect = createElement('select', 'model-select')
  modelSelect.setAttribute('aria-label', 'Model')
  const lookSelect = createElement('select', 'look-select')
  lookSelect.setAttribute('aria-label', 'Look')
  const initialLook = getLookPreset(location.search)
  lookSelect.append(
    ...LOOK_PRESETS.map(
      (preset) => new Option(LOOK_APPEARANCES[preset].label, preset, false, preset === initialLook)
    )
  )
  bar.append(modelSelect, lookSelect)
  const stage = createElement('div', 'stage')
  const status = createElement('pre', 'status')
  const panel = createElement('section', 'panel')
  panel.setAttribute('role', 'tabpanel')
  panel.append(stage, bar, status)
  root.append(createTabList(), panel)

  const controller = createModelsTabController(
    stage,
    {
      showFolders: (folders, selectedPath) => fillModelSelect(modelSelect, folders, selectedPath),
      showStatus: (text) => {
        status.textContent = text
      },
    },
    { path: decodeURIComponent(location.hash.replace(/^#/, '')) || null, look: initialLook }
  )

  const onModelChange = () => controller.selectModel(modelSelect.value)
  const onLookChange = () =>
    controller.setLook(
      LOOK_PRESETS.find((preset) => preset === lookSelect.value) ?? LookPreset.MANUAL
    )
  modelSelect.addEventListener('change', onModelChange)
  lookSelect.addEventListener('change', onLookChange)
}
