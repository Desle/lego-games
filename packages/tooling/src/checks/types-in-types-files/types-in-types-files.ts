import typescript from 'typescript'
import { getIsTestFile } from '../../project/project-files.ts'
import { getLineNumber, parseSource, visitAllNodes } from '../../project/parse-source.ts'
import { CheckId, type Check, type Violation } from '../check.types.ts'
import { getEscapeHatchComment, getIsAllowedByEscapeHatch } from '../escape-hatch/escape-hatch.ts'

const getIsTypesFile = (path: string) => /\.types\.[cm]?tsx?$/.test(path) || path.endsWith('.d.ts')

const getIsDeclaration = (node: typescript.Node) =>
  typescript.isInterfaceDeclaration(node) || typescript.isTypeAliasDeclaration(node)

// A `{ … }` type nested in a declaration or in another one is reported once, at the outermost.
const getIsOutermostInlineType = (node: typescript.Node): boolean => {
  if (!typescript.isTypeLiteralNode(node)) return false
  for (let ancestor = node.parent; !typescript.isSourceFile(ancestor); ancestor = ancestor.parent)
    if (getIsDeclaration(ancestor) || typescript.isTypeLiteralNode(ancestor)) return false
  return true
}

const getMessage = (node: typescript.Node): string =>
  getIsDeclaration(node)
    ? `'${node.name.text}' is declared in an implementation file`
    : 'an inline object type (`{ … }`) in an implementation file; name it in a .types.ts file'

export const findInlineTypeDeclarations = (path: string, content: string): readonly Violation[] => {
  if (getIsTypesFile(path) || getIsTestFile(path)) return []
  const sourceFile = parseSource(path, content)
  const violations: Violation[] = []
  visitAllNodes(sourceFile, (node) => {
    if (!getIsDeclaration(node) && !getIsOutermostInlineType(node)) return
    const line = getLineNumber(sourceFile, node)
    if (getIsAllowedByEscapeHatch(sourceFile.text, line, CheckId.TYPES_IN_TYPES_FILES)) return
    violations.push({ path, line, message: getMessage(node) })
  })
  return violations
}

export const typesInTypesFilesCheck: Check = {
  id: CheckId.TYPES_IN_TYPES_FILES,
  description: 'Type and interface declarations, and object types, live in *.types.ts files.',
  fix: `Move the declaration (or give the inline object type a name) into a sibling <name>.types.ts file, or add '${getEscapeHatchComment(CheckId.TYPES_IN_TYPES_FILES)}'.`,
  run: (context) =>
    Promise.resolve(
      [...context.sourceFiles].flatMap(([path, content]) =>
        findInlineTypeDeclarations(path, content)
      )
    ),
}
