import fs from 'node:fs'
import path from 'node:path'

import { compile } from '../compiler'
import { collectFixtures, resolveFixtureDirs } from './fixtures-utils'

const DEFAULT_DIRS = resolveFixtureDirs()

const runPerf = () => {
  const maxFiles = process.env.PERF_MAX ? Number(process.env.PERF_MAX) : undefined
  const dirs = process.env.PERF_DIRS
    ? process.env.PERF_DIRS.split(',').map(dir => path.resolve(process.cwd(), dir.trim()))
    : DEFAULT_DIRS

  const files: string[] = []
  for (const dir of dirs) {
    files.push(...collectFixtures(dir))
  }

  const list = maxFiles ? files.slice(0, maxFiles) : files
  const start = process.hrtime.bigint()

  for (const file of list) {
    const source = fs.readFileSync(file, 'utf8')
    compile(source, { fileName: file })
  }

  const end = process.hrtime.bigint()
  const elapsedMs = Number(end - start) / 1_000_000
  const mem = process.memoryUsage()

  console.log(`Perf: compiled ${list.length} files in ${elapsedMs.toFixed(2)}ms`) 
  console.log(`Memory: rss=${mem.rss} heapUsed=${mem.heapUsed}`)
}

if (require.main === module) {
  runPerf()
}
