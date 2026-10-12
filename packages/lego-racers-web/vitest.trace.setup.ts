// The viewer's materials read the page's query string; the trace specs run in Node, where there is no page.
Object.defineProperty(globalThis, 'location', {
  value: Object.freeze({ search: '' }),
  configurable: true,
})
