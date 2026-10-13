import type { BuilderRemoveControl, BuilderRemoveView } from './builder-remove-control.types.ts'

const createButton = (text: string, className: string, onClick: () => void) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}

// The bar's Remove model button and its question, asked in the bar: a dialog would block the page (and its automation).
export const createBuilderRemoveControl = (onRemove: () => void): BuilderRemoveControl => {
  const element = document.createElement('span')
  element.className = 'remove-control'
  const question = document.createElement('span')
  question.className = 'remove-question'
  const questionText = document.createElement('span')
  const setIsAsked = (isAsked: boolean) => {
    askButton.hidden = isAsked
    question.hidden = !isAsked
  }
  const askButton = createButton('Remove model', 'remove', () => setIsAsked(true))
  askButton.title = 'Move the file to drafts/backups so the game falls back to the original'
  const confirmButton = createButton('Remove', 'remove-confirm', () => {
    setIsAsked(false)
    onRemove()
  })
  const cancelButton = createButton('Cancel', 'remove-cancel', () => setIsAsked(false))
  question.append(questionText, confirmButton, cancelButton)
  element.append(askButton, question)
  element.hidden = true
  setIsAsked(false)

  return {
    element,
    show: (view: BuilderRemoveView) => {
      element.hidden = !view.isShown
      questionText.textContent = `Remove ${view.file}? It moves to drafts/backups.`
      setIsAsked(false)
    },
    setIsBusy: (isBusy) => {
      askButton.disabled = isBusy
      confirmButton.disabled = isBusy
    },
  }
}
