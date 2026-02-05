#!/usr/bin/env tsx
import fs from 'fs/promises'
import path from 'path'
import ts from 'typescript'

import { QuickJSLib } from './QuickJSLib'
import { collectFixtures } from './compareWithWasm'

const DEFAULT_FIXTURES_DIRS = [
  path.resolve(process.cwd(), 'fixtures/basic'),
  path.resolve(process.cwd(), 'fixtures/es2020'),
  path.resolve(process.cwd(), 'fixtures/quickjs'),
]

const hasTopLevelAwait = (source: string, sourcePath: string): boolean => {
  const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  let found = false
  const visit = (node: ts.Node, inFunction: boolean) => {
    if (found) return
    if (!inFunction && ts.isAwaitExpression(node)) {
      found = true
      return
    }
    const nextInFunction = inFunction || ts.isFunctionLike(node) || ts.isClassLike(node)
    ts.forEachChild(node, child => visit(child, nextInFunction))
  }
  visit(file, false)
  return found
}

const hasImportMeta = (source: string, sourcePath: string): boolean => {
  const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta') {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

const rewriteImportMetaForScript = (source: string): string => {
  if (!source.includes('import.meta')) return source
  const header = 'const __import_meta__ = { url: undefined };\n'
  return header + source.replace(/\bimport\.meta\b/g, '__import_meta__')
}

const wrapTopLevelAwait = (source: string): string => (
  `;(async () => {\n${source}\n})();\n`
)

const transpileForWasm = (source: string, sourcePath: string): string => {
  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  })
  return result.outputText
}

const runFixture = async (filePath: string): Promise<{ file: string; status: 'pass' | 'fail'; error?: string }> => {
  try {
    const source = await fs.readFile(filePath, 'utf8')
    const rewritten = hasImportMeta(source, filePath)
      ? rewriteImportMetaForScript(source)
      : source
    const normalized = hasTopLevelAwait(rewritten, filePath)
      ? wrapTopLevelAwait(rewritten)
      : rewritten
    const transpiled = transpileForWasm(normalized, filePath)
    const bytes = await QuickJSLib.compileSourceAsScript(transpiled, filePath)
    await QuickJSLib.runBytes(bytes)
    return { file: filePath, status: 'pass' }
  } catch (error) {
    return { file: filePath, status: 'fail', error: String(error) }
  }
}

const main = async () => {
  console.log(`Running fixtures in ${DEFAULT_FIXTURES_DIRS.join(', ')}`)
  const maxFiles = (() => {
    const raw = process.env.RUN_MAX_FILES
    if (!raw) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  })()

  const results: Array<{ file: string; status: 'pass' | 'fail'; error?: string }> = []

  for (const dir of DEFAULT_FIXTURES_DIRS) {
    const fixtures = await collectFixtures(dir)
    const slice = maxFiles ? fixtures.slice(0, maxFiles) : fixtures
    for (const file of slice) {
      const result = await runFixture(file)
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
  console.log(`Overall: ${failed > 0 ? 'FAIL' : 'PASS'}`)
  if (failed > 0) {
    console.log('\nFailed fixtures:')
    for (const result of results) {
      if (result.status !== 'fail') continue
      const rel = path.relative(process.cwd(), result.file)
      const msg = result.error ? ` (${result.error})` : ''
      console.log(`- ${rel}${msg}`)
    }
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(String(error))
    process.exitCode = 1
  })
}
