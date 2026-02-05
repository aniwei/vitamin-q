#!/usr/bin/env tsx
import path from 'path'

import { compareFixture } from './compareWithWasm'

const main = async () => {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: compareWithWasmDebug <fixture-path>')
    process.exitCode = 1
    return
  }

  const absPath = path.resolve(process.cwd(), target)
  const rel = path.relative(process.cwd(), absPath)
  process.env.COMPARE_DEBUG_FILE = rel

  const result = await compareFixture(absPath)
  console.log(result)
  if (result.status === 'fail') {
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(String(error))
    process.exitCode = 1
  })
}
