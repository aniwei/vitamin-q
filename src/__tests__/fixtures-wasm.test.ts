import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { compareFixtures } from '../../scripts/compareWithWasm'

const ROOT = process.cwd()
const BASIC_DIR = path.resolve(ROOT, 'fixtures/basic')
const ES2020_DIR = path.resolve(ROOT, 'fixtures/es2020')

const assertAllPassed = (results: { status: 'pass' | 'fail'; file: string; error?: string }[]) => {
  const failed = results.filter(r => r.status === 'fail')
  if (failed.length === 0) return
  const details = failed.slice(0, 5).map(r => `${r.file}: ${r.error ?? 'unknown error'}`).join('\n')
  assert.equal(failed.length, 0, `WASM 对比失败 ${failed.length} 项:\n${details}`)
}

test('fixtures/basic: wasm 对齐', async () => {
  const results = await compareFixtures([BASIC_DIR])
  assertAllPassed(results)
})

test('fixtures/es2020: wasm 对齐', async () => {
  const results = await compareFixtures([ES2020_DIR])
  assertAllPassed(results)
})
