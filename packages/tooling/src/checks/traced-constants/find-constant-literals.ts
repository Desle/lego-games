import typescript from 'typescript'
import { getLineNumber, parseSource, visitAllNodes } from '../../project/parse-source.ts'
import { CheckId } from '../check.types.ts'
import { getIsAllowedByEscapeHatch } from '../escape-hatch/escape-hatch.ts'
import type { ConstantLiteral } from './traced-constants.types.ts'

// 0 and 1 are identity and unit, -1 is a sentinel or a flip, 2 is a half or a pair: none of them tunes behaviour.
const STRUCTURAL_VALUES: ReadonlySet<number> = new Set([0, 1, -1, 2])
// Full-width bit masks, only when spelled in hex: they select bytes, they do not tune anything.
const STRUCTURAL_MASKS: ReadonlySet<string> = new Set(['0xff', '0xffff', '0xffffff', '0xffffffff'])
// Shifting by whole bytes is how multi-byte values are assembled.
const STRUCTURAL_SHIFT_COUNTS: ReadonlySet<number> = new Set([8, 16, 24, 32])
const SHIFT_OPERATORS: ReadonlySet<typescript.SyntaxKind> = new Set([
  typescript.SyntaxKind.LessThanLessThanToken,
  typescript.SyntaxKind.GreaterThanGreaterThanToken,
  typescript.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
])
const ORIGINAL_ADDRESS = /\b0x(?:00|10)[0-9a-f]{6}\b/i
const COMMENT_ONLY_LINE = /^\s*(?:\/\/|\/\*|\*)/

const getIsFunctionBoundary = (node: typescript.Node) =>
  typescript.isFunctionLike(node) || typescript.isClassLike(node)

// A leading minus belongs to the literal: `-0.5` is one constant.
const getLiteralRoot = (node: typescript.NumericLiteral): typescript.Expression => {
  const { parent } = node
  return typescript.isPrefixUnaryExpression(parent) &&
    parent.operator === typescript.SyntaxKind.MinusToken
    ? parent
    : node
}

const getIsStructuralPosition = (root: typescript.Expression, text: string): boolean => {
  const { parent } = root
  if (typescript.isElementAccessExpression(parent) && parent.argumentExpression === root)
    return true
  if (typescript.isBinaryExpression(parent) && parent.right === root)
    return (
      SHIFT_OPERATORS.has(parent.operatorToken.kind) && STRUCTURAL_SHIFT_COUNTS.has(Number(text))
    )
  return false
}

const getIsStructuralValue = (root: typescript.Expression, sourceText: string): boolean => {
  const value = Number(sourceText.replaceAll('_', ''))
  const signedValue = typescript.isPrefixUnaryExpression(root) ? -value : value
  return (
    STRUCTURAL_VALUES.has(signedValue) ||
    STRUCTURAL_MASKS.has(sourceText.toLowerCase().replaceAll('_', '')) ||
    getIsStructuralPosition(root, sourceText)
  )
}

const getIsInTypePosition = (node: typescript.Node): boolean => {
  for (let ancestor = node.parent; !typescript.isSourceFile(ancestor); ancestor = ancestor.parent)
    if (typescript.isTypeNode(ancestor)) return true
  return false
}

const getDeclarationName = (node: typescript.Node): string | null => {
  const isNamed =
    typescript.isFunctionDeclaration(node) ||
    typescript.isVariableDeclaration(node) ||
    typescript.isMethodDeclaration(node) ||
    typescript.isPropertyDeclaration(node) ||
    typescript.isPropertyAssignment(node) ||
    typescript.isClassDeclaration(node)
  if (!isNamed || node.name === undefined) return null
  const { name } = node
  return typescript.isIdentifier(name) || typescript.isStringLiteral(name) ? name.text : null
}

const getScope = (node: typescript.Node): string => {
  const names: string[] = []
  for (let ancestor = node.parent; !typescript.isSourceFile(ancestor); ancestor = ancestor.parent) {
    const name = getDeclarationName(ancestor)
    if (name !== null) names.unshift(name)
  }
  return names.join('.')
}

// Comments are read from the AST's trivia so an address inside a string or the code itself never counts.
const collectCommentLines = (sourceFile: typescript.SourceFile): ReadonlyMap<number, string> => {
  const { text } = sourceFile
  const seenPositions = new Set<number>()
  const commentLines = new Map<number, string>()
  const register = (range: typescript.CommentRange) => {
    if (seenPositions.has(range.pos)) return
    seenPositions.add(range.pos)
    const commentText = text.slice(range.pos, range.end)
    const firstLine = sourceFile.getLineAndCharacterOfPosition(range.pos).line + 1
    const lastLine = sourceFile.getLineAndCharacterOfPosition(range.end).line + 1
    for (let line = firstLine; line <= lastLine; line += 1)
      commentLines.set(line, `${commentLines.get(line) ?? ''}${commentText}`)
  }
  visitAllNodes(sourceFile, (node) => {
    for (const range of typescript.getLeadingCommentRanges(text, node.getFullStart()) ?? [])
      register(range)
    for (const range of typescript.getTrailingCommentRanges(text, node.getEnd()) ?? [])
      register(range)
    // A comment after a comma belongs to the previous token's line, which only the next node's full start reaches.
    for (const range of typescript.getTrailingCommentRanges(text, node.getFullStart()) ?? [])
      register(range)
  })
  return commentLines
}

// The statement of the nearest named `const` the literal initialises without crossing a function or class.
const getEnclosingConstantStatement = (node: typescript.Node): typescript.Node | null => {
  for (let ancestor = node.parent; !typescript.isSourceFile(ancestor); ancestor = ancestor.parent) {
    if (getIsFunctionBoundary(ancestor)) return null
    if (
      typescript.isVariableDeclaration(ancestor) &&
      typescript.isIdentifier(ancestor.name) &&
      typescript.isVariableDeclarationList(ancestor.parent) &&
      (ancestor.parent.flags & typescript.NodeFlags.Const) !== 0
    )
      return ancestor.parent.parent
  }
  return null
}

export const findConstantLiterals = (path: string, content: string): readonly ConstantLiteral[] => {
  const sourceFile = parseSource(path, content)
  const lines = sourceFile.text.split('\n')
  const commentLines = collectCommentLines(sourceFile)
  // The comment sits on the line itself, or alone on the line above (never on a neighbouring statement's line).
  const getHasAddress = (line: number): boolean =>
    ORIGINAL_ADDRESS.test(commentLines.get(line) ?? '') ||
    (COMMENT_ONLY_LINE.test(lines[line - 2] ?? '') &&
      ORIGINAL_ADDRESS.test(commentLines.get(line - 1) ?? ''))
  const found: ConstantLiteral[] = []
  visitAllNodes(sourceFile, (node) => {
    if (!typescript.isNumericLiteral(node) || getIsInTypePosition(node)) return
    const root = getLiteralRoot(node)
    if (getIsStructuralValue(root, node.getText(sourceFile))) return
    const line = getLineNumber(sourceFile, root)
    const statement = getEnclosingConstantStatement(root)
    const statementLine = statement === null ? null : getLineNumber(sourceFile, statement)
    if (statementLine !== null && (getHasAddress(statementLine) || getHasAddress(line))) return
    const isAllowed = [line, statementLine].some(
      (candidate) =>
        candidate !== null &&
        getIsAllowedByEscapeHatch(sourceFile.text, candidate, CheckId.TRACED_CONSTANTS)
    )
    if (isAllowed) return
    found.push({
      path,
      line,
      scope: getScope(node),
      literal: root.getText(sourceFile).replaceAll(/\s+/g, ''),
    })
  })
  return found
}
