import typescript from 'typescript'

const SINGLE_FILE_COMPONENT_EXTENSIONS = ['.vue', '.svelte', '.astro']

const SCRIPT_BLOCK = /(<script[^>]*>)([\s\S]*?)<\/script>/g

const blankOut = (text: string) => text.replace(/[^\n]/g, ' ')

// Keeps line numbers stable by blanking everything outside <script> blocks instead of dropping it.
export const getScriptContent = (path: string, content: string): string => {
  const isSingleFileComponent = SINGLE_FILE_COMPONENT_EXTENSIONS.some((extension) =>
    path.endsWith(extension)
  )
  if (!isSingleFileComponent) return content
  const parts: string[] = []
  let cursor = 0
  for (const match of content.matchAll(SCRIPT_BLOCK)) {
    const bodyStart = match.index + (match[1] ?? '').length
    const body = match[2] ?? ''
    parts.push(blankOut(content.slice(cursor, bodyStart)), body)
    cursor = bodyStart + body.length
  }
  parts.push(blankOut(content.slice(cursor)))
  return parts.join('')
}

const getScriptKind = (path: string): typescript.ScriptKind => {
  if (path.endsWith('.tsx')) return typescript.ScriptKind.TSX
  if (path.endsWith('.jsx')) return typescript.ScriptKind.JSX
  if (/\.[cm]?js$/.test(path)) return typescript.ScriptKind.JS
  return typescript.ScriptKind.TS
}

export const parseSource = (path: string, content: string): typescript.SourceFile =>
  typescript.createSourceFile(
    path,
    getScriptContent(path, content),
    typescript.ScriptTarget.Latest,
    true,
    getScriptKind(path)
  )

export const getLineNumber = (sourceFile: typescript.SourceFile, node: typescript.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

export const visitAllNodes = (
  node: typescript.Node,
  visit: (node: typescript.Node) => void
): void => {
  visit(node)
  // visitAllNodes returns nothing, so forEachChild (which stops on a truthy return) visits every child.
  typescript.forEachChild(node, (child) => visitAllNodes(child, visit))
}
