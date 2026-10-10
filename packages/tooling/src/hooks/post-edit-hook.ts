import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { ESLint } from 'eslint'
import * as prettier from 'prettier'
import { readHookInput } from './read-hook-input.ts'

const getEditedFile = (root: string): string | null => {
  const toolInput = readHookInput()['tool_input']
  if (typeof toolInput !== 'object' || toolInput === null) return null
  const filePath: unknown = (toolInput as Record<string, unknown>)['file_path']
  if (typeof filePath !== 'string') return null
  const absolutePath = isAbsolute(filePath) ? filePath : join(root, filePath)
  const projectPath = relative(root, absolutePath)
  const isInsideProject = !projectPath.startsWith('..') && !isAbsolute(projectPath)
  const isDependency = projectPath.split(/[\\/]/).includes('node_modules')
  return isInsideProject && !isDependency && existsSync(absolutePath) ? absolutePath : null
}

// In a workspace each package has its own ESLint config, so lint from the edited file's package.
const getPackageDirectory = (root: string, absolutePath: string): string => {
  let directory = dirname(absolutePath)
  while (relative(root, directory) !== '' && !relative(root, directory).startsWith('..')) {
    if (existsSync(join(directory, 'package.json'))) return directory
    directory = dirname(directory)
  }
  return root
}

const fixLint = async (root: string, absolutePath: string): Promise<string | null> => {
  const eslint = new ESLint({ cwd: getPackageDirectory(root, absolutePath), fix: true })
  const isLinted =
    !(await eslint.isPathIgnored(absolutePath)) &&
    (await eslint.calculateConfigForFile(absolutePath)) !== undefined
  if (!isLinted) return null
  const results = await eslint.lintFiles([absolutePath])
  await ESLint.outputFixes(results)
  const remainingErrors = results.reduce((count, result) => count + result.errorCount, 0)
  if (remainingErrors === 0) return null
  const formatter = await eslint.loadFormatter('stylish')
  return formatter.format(results)
}

const formatFile = async (absolutePath: string) => {
  const fileInfo = await prettier.getFileInfo(absolutePath, { ignorePath: '.prettierignore' })
  if (fileInfo.ignored || fileInfo.inferredParser === null) return
  const options = (await prettier.resolveConfig(absolutePath)) ?? {}
  const content = readFileSync(absolutePath, 'utf8')
  const formatted = await prettier.format(content, { ...options, filepath: absolutePath })
  if (formatted !== content) writeFileSync(absolutePath, formatted)
}

/** Claude Code PostToolUse: fix and format the edited file; exit code 2 feeds remaining errors back to Claude. */
export const runPostEditHook = async (root: string): Promise<number> => {
  const absolutePath = getEditedFile(root)
  if (absolutePath === null) return 0
  const lintReport = await fixLint(root, absolutePath)
  await formatFile(absolutePath)
  if (lintReport === null) return 0
  process.stderr.write(
    `ESLint errors remain in ${relative(root, absolutePath)} after auto-fix — fix them now:\n${lintReport}`
  )
  return 2
}
