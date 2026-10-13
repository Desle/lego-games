import { listenForParseRequests } from '../../../geometry/index.ts'

// The viewer's parse worker: a model is drawn whole, nothing is split out of it.
listenForParseRequests(null)
