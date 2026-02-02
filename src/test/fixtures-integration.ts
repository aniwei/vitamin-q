import fs from 'node:fs'
import path from 'node:path'

import { compile } from '../compiler'
import { collectFixtures, resolveFixtureDirs } from './fixtures-utils'

export interface FixtureResult {
  file: string
  status: 'pass' | 'fail'
  error?: string
}

const FIXTURE_DIRS = resolveFixtureDirs()

const compileFixture = (filePath: string): FixtureResult => {
  try {
    const source = fs.readFileSync(filePath, 'utf8')
    compile(source, { fileName: filePath })
    return { file: filePath, status: 'pass' }
  } catch (error) {
    return { file: filePath, status: 'fail', error: String(error) }
  }
}

export const runFixturesIntegration = (): FixtureResult[] => {
  const maxFiles = process.env.FIXTURES_MAX ? Number(process.env.FIXTURES_MAX) : undefined
  const results: FixtureResult[] = []

  for (const dir of FIXTURE_DIRS) {
    const fixtures = collectFixtures(dir)
    const list = maxFiles ? fixtures.slice(0, maxFiles) : fixtures
    for (const file of list) {
      const result = compileFixture(file)
      results.push(result)
      const status = result.status === 'pass' ? '✅' : '❌'
      const rel = path.relative(process.cwd(), file)
      const msg = result.error ? ` (${result.error})` : ''
      console.log(`${status} ${rel}${msg}`)
    }
  }

  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  console.log(`\nSummary: ${passed} passed, ${failed} failed (total ${results.length})`)

  if (failed > 0) process.exitCode = 1
  return results
}

if (require.main === module) {
  runFixturesIntegration()
}
