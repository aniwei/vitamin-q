import fs from 'node:fs'
import path from 'node:path'

import { compile } from '../compiler'
import { QuickJSLib } from '../../scripts/QuickJSLib'
import { compareBytecode } from '../runtime/comparator'
import { validateExecution } from '../runtime/execution-validator'
import { formatDiffReport, renderDiffText } from './diff-reporter'
import { compareSnapshot, saveSnapshot } from './snapshot-manager'
import { collectFixtures, resolveFixtureDirs } from './fixtures-utils'

export interface AlignmentResult {
  file: string
  status: 'pass' | 'fail'
  error?: string
}

const FIXTURE_DIRS = resolveFixtureDirs()

const compileWithTs = (filePath: string): Uint8Array => {
  const source = fs.readFileSync(filePath, 'utf8')
  return compile(source, { fileName: filePath }).bytecode
}

const compileWithWasm = async (filePath: string): Promise<Uint8Array> => {
  const source = fs.readFileSync(filePath, 'utf8')
  return QuickJSLib.compileSourceAsScript(source, filePath)
}

const shouldUpdateSnapshots = () => process.env.ALIGNMENT_UPDATE === '1'
const shouldCheckSnapshots = () => process.env.ALIGNMENT_SNAPSHOT === '1'

const compareFixture = async (filePath: string): Promise<AlignmentResult> => {
  try {
    const ours = compileWithTs(filePath)
    const wasm = await compileWithWasm(filePath)

    const diff = compareBytecode(ours, wasm)
    if (!diff.match) {
      const report = formatDiffReport(ours, wasm, filePath, diff.diffIndex)
      return { file: filePath, status: 'fail', error: renderDiffText(report) }
    }

    const exec = await validateExecution(ours, wasm)
    if (!exec.match) {
      const msg = exec.stdoutDiff ?? exec.stderrDiff ?? 'execution mismatch'
      return { file: filePath, status: 'fail', error: msg }
    }

    if (shouldCheckSnapshots() && !compareSnapshot(filePath, ours)) {
      return { file: filePath, status: 'fail', error: 'snapshot mismatch' }
    }

    if (shouldUpdateSnapshots()) {
      saveSnapshot(filePath, ours)
    }

    return { file: filePath, status: 'pass' }
  } catch (error) {
    return { file: filePath, status: 'fail', error: String(error) }
  }
}

export const runAlignment = async (): Promise<AlignmentResult[]> => {
  const maxFiles = process.env.ALIGNMENT_MAX ? Number(process.env.ALIGNMENT_MAX) : undefined
  const results: AlignmentResult[] = []

  for (const dir of FIXTURE_DIRS) {
    const fixtures = collectFixtures(dir)
    const list = maxFiles ? fixtures.slice(0, maxFiles) : fixtures
    for (const file of list) {
      const result = await compareFixture(file)
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
  runAlignment().catch((error) => {
    console.error(String(error))
    process.exit(1)
  })
}
