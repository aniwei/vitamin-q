import ts from 'typescript'

import { BytecodeCompiler } from '../emitter/emitter'
import { LabelResolver } from '../label/label-resolver'
import { resolveVariables } from '../label/resolve-variables'
import { peepholeOptimize } from '../optimizer/peephole'
import { convertShortOpcodes } from '../optimizer/short-opcodes'
import { eliminateDeadCode } from '../optimizer/dead-code'
import type { AtomTable } from '../atom/atom-table'
import type { JSFunctionBytecodeView } from '../types/function-bytecode'
import type { JSAtom } from '../types/function-def'

export interface CreateFunctionOptions {
  sourceFile: ts.SourceFile
  atomTable?: AtomTable
  stripDebug?: boolean
  stripSource?: boolean
  useShortOpcodes?: boolean
  strict?: boolean
}

/**
 * js_create_function（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:14730-15080
 * @see js_create_function
 */
export const createFunction = (options: CreateFunctionOptions): JSFunctionBytecodeView => {
  const compiler = new BytecodeCompiler({
    atomTable: options.atomTable,
    expressionStatementDrop: true,
    strict: options.strict,
  })

  const state = compiler.compileWithState(options.sourceFile)
  const raw = state.bytecode.toUint8Array()
  const phase2 = resolveVariables(raw, state.labels.getSlots().length)
  const resolved = new LabelResolver().resolve(phase2, state.labels.getSlots())

  const optimized = eliminateDeadCode(
    convertShortOpcodes(
      peepholeOptimize(resolved),
    ),
  )

  const atomTable = options.atomTable
  const filenameAtom = atomTable
    ? atomTable.getOrAdd(options.sourceFile.fileName)
    : (0 as JSAtom)

  return {
    flags: {
      hasDebug: !options.stripDebug,
      readOnlyBytecode: false,
      isDirectOrIndirectEval: false,
    },
    byteCode: optimized,
    cpool: state.constantPool.toArray(),
    vardefs: {
      argCount: 0,
      varCount: state.scopes.vars.length,
      vardefs: state.scopes.vars.map(v => ({
        varName: v.varName,
        scopeLevel: v.scopeLevel,
        scopeNext: v.scopeNext,
        isConst: v.isConst,
        isLexical: v.isLexical,
        isCaptured: v.isCaptured,
        varKind: v.varKind,
      })),
    },
    closure: {
      closureVarCount: 0,
      closureVar: [],
    },
    debug: options.stripDebug
      ? null
      : {
          filename: filenameAtom,
          pc2lineBuf: new Uint8Array(),
        },
    source: options.stripSource
      ? null
      : {
          source: options.sourceFile.text,
          sourceLen: options.sourceFile.text.length,
        },
  }
}
