import { mountStudioPage } from './modules/studio/index.ts'

const root = document.getElementById('studio')
if (root === null) throw new Error('index.html has no #studio')
mountStudioPage(root)
