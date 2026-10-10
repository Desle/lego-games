export const getProjectRoot = (): string => process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd()
