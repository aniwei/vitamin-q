#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

import { compileFile } from './compiler'
import { dumpBytecode } from './debug/bytecode-dump'

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2)
  const options: { input?: string; out?: string; module?: boolean; stripDebug?: boolean; stripSource?: boolean; dump?: boolean } = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue
    if (arg === '--out') {
      options.out = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--module') {
      options.module = true
      continue
    }
    if (arg === '--strip-debug') {
      options.stripDebug = true
      continue
    }
    if (arg === '--strip-source') {
      options.stripSource = true
      continue
    }
    if (arg === '--dump') {
      options.dump = true
      process.env.DUMP_BYTECODE = '1'
      continue
    }
    if (!options.input) {
      options.input = arg
    }
  }
  return options
}

/**
 * CLI 入口（占位实现）。
 *
 * @source QuickJS/src/core/qjsc.c:1-200
 */
const main = () => {
  const options = parseArgs(process.argv)
  if (!options.input) {
    console.error('Usage: vitq <input> [--out <file>] [--module] [--strip-debug] [--strip-source] [--dump]')
    process.exitCode = 1
    return
  }

  const inputPath = path.resolve(process.cwd(), options.input)
  const outPath = options.out ?? `${inputPath}.qjsc`

  const result = compileFile(inputPath, {
    module: options.module,
    stripDebug: options.stripDebug,
    stripSource: options.stripSource,
  })

  fs.writeFileSync(outPath, result.bytecode)

  if (options.dump) {
    const dump = dumpBytecode(result.bytecode, { force: true })
    if (dump) console.log(dump)
  }
}

if (require.main === module) {
  main()
}
