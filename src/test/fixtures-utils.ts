import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_FIXTURE_DIRS = [
  path.resolve(process.cwd(), 'fixtures/basic'),
  path.resolve(process.cwd(), 'fixtures/es2020'),
]

export const collectFixtures = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFixtures(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

export const resolveFixtureDirs = (): string[] => {
  if (!process.env.FIXTURES_DIRS) return DEFAULT_FIXTURE_DIRS
  return process.env.FIXTURES_DIRS
    .split(',')
    .map(dir => path.resolve(process.cwd(), dir.trim()))
    .filter(Boolean)
}
