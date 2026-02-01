import ts from 'typescript'

import { DEFINE_GLOBAL_FUNC_VAR, Opcode } from '../env'
import { BytecodeCompiler, EmitterContext } from './emitter'
import { BytecodeBuffer } from './bytecode-buffer'
import { ConstantPoolManager } from './constant-pool'
import { InlineCacheManager } from './inline-cache'
import { DestructuringEmitter } from './destructuring'

export interface FunctionTemplate {
  kind: 'function'
  name?: string
  params: string[]
  isArrow: boolean
  isAsync: boolean
  isGenerator: boolean
  bodyText: string
  bytecode?: Uint8Array
}

const createTemplate = (node: ts.FunctionLikeDeclarationBase, sourceFile: ts.SourceFile): FunctionTemplate => {
  const params: string[] = []
  for (const param of node.parameters) {
    if (ts.isIdentifier(param.name)) {
      params.push(param.name.text)
    } else {
      params.push(param.name.getText(sourceFile))
    }
  }

  return {
    kind: 'function',
    name: node.name && ts.isIdentifier(node.name) ? node.name.text : undefined,
    params,
    isArrow: ts.isArrowFunction(node),
    isAsync: Boolean(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)),
    isGenerator: Boolean((node as ts.FunctionDeclaration | ts.FunctionExpression).asteriskToken),
    bodyText: node.body ? node.body.getText(sourceFile) : '',
  }
}

/**
 * 函数发射器（最小闭包模板，后续由编译器 Pass 完成）。
 *
 * @source QuickJS/src/core/parser.c:12979-13618
 * @see js_parse_function_decl2
 */
export class FunctionEmitter {
  private destructuringEmitter = new DestructuringEmitter()

  emitFunctionExpression(node: ts.FunctionExpression | ts.ArrowFunction, context: EmitterContext) {
    this.emitFunctionClosure(node, context, { setName: true })
  }

  emitFunctionDeclaration(node: ts.FunctionDeclaration, context: EmitterContext) {
    if (!node.name || !ts.isIdentifier(node.name)) {
      throw new Error('函数声明必须包含标识符名称')
    }
    const name = node.name.text
    const atom = context.getAtom(name)

    context.bytecode.emitOp(Opcode.OP_check_define_var)
    context.bytecode.emitAtom(atom)
    context.bytecode.emitU8(DEFINE_GLOBAL_FUNC_VAR)

    this.emitFunctionClosure(node, context)

    context.bytecode.emitOp(Opcode.OP_define_func)
    context.bytecode.emitAtom(atom)
    context.bytecode.emitU8(0)
  }

  private createFunctionTemplate(
    node: ts.FunctionLikeDeclarationBase,
    context: EmitterContext,
    options: { privateBindings?: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }> } = {},
  ): FunctionTemplate {
    const template = createTemplate(node, context.sourceFile)
    template.bytecode = this.compileFunctionBody(node, context, options)
    return template
  }

  buildFunctionTemplate(node: ts.FunctionLikeDeclarationBase, context: EmitterContext): FunctionTemplate {
    return this.createFunctionTemplate(node, context)
  }

  emitFunctionClosure(
    node: ts.FunctionLikeDeclarationBase,
    context: EmitterContext,
    options: {
      setName?: boolean
      privateBindings?: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }>
    } = {},
  ) {
    const template = this.createFunctionTemplate(node, context, {
      privateBindings: options.privateBindings,
    })
    const idx = context.constantPool.add(template)
    context.bytecode.emitOp(Opcode.OP_fclosure)
    context.bytecode.emitU32(idx)

    if (options.setName && template.name) {
      const atom = context.getAtom(template.name)
      context.bytecode.emitOp(Opcode.OP_set_name)
      context.bytecode.emitAtom(atom)
    }
  }

  private compileFunctionBody(
    node: ts.FunctionLikeDeclarationBase,
    parentContext: EmitterContext,
    options: { privateBindings?: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }> } = {},
  ): Uint8Array {
    const bytecode = new BytecodeBuffer()
    const inlineCache = new InlineCacheManager()
    const constantPool = new ConstantPoolManager()
    const compiler = new BytecodeCompiler({
      atomTable: parentContext.atomTable,
      inlineCache,
      constantPool,
      bytecode,
      expressionStatementDrop: true,
    })
    const argMap = new Map<string, number>()
    node.parameters.forEach((param, index) => {
      if (ts.isIdentifier(param.name)) {
        argMap.set(param.name.text, index)
      }
    })

    const context = new EmitterContext({
      sourceFile: parentContext.sourceFile,
      atomTable: parentContext.atomTable,
      bytecode,
      inlineCache,
      constantPool,
      argMap,
      inFunction: true,
      inAsync: Boolean(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)),
      inGenerator: Boolean((node as ts.FunctionDeclaration | ts.FunctionExpression).asteriskToken),
      privateBindings: options.privateBindings,
    })

    if (!node.body) {
      if (context.inAsync) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else {
        context.bytecode.emitOp(Opcode.OP_return_undef)
      }
      return bytecode.toUint8Array()
    }

    if (ts.isBlock(node.body)) {
      if (context.inGenerator) {
        context.bytecode.emitOp(Opcode.OP_initial_yield)
      }
      this.emitParameterInitializers(node, context, compiler)
      compiler.compileStatements(node.body.statements, context)
      this.ensureReturn(bytecode, context)
      return bytecode.toUint8Array()
    }

    // Arrow function expression body
    if (context.inGenerator) {
      context.bytecode.emitOp(Opcode.OP_initial_yield)
    }
    this.emitParameterInitializers(node, context, compiler)
    compiler.emitExpression(node.body, context)
    if (context.inAsync) {
      context.bytecode.emitOp(Opcode.OP_return_async)
    } else {
      context.bytecode.emitOp(Opcode.OP_return)
    }
    return bytecode.toUint8Array()
  }

  /**
   * 参数初始化（默认值/剩余参数）。
   *
   * @source QuickJS/src/core/parser.c:13193-13318
   * @see js_parse_function_decl2
   */
  private emitParameterInitializers(
    node: ts.FunctionLikeDeclarationBase,
    context: EmitterContext,
    compiler: BytecodeCompiler,
  ) {
    node.parameters.forEach((param, index) => {
      const isBindingPattern = ts.isObjectBindingPattern(param.name) || ts.isArrayBindingPattern(param.name)

      if (isBindingPattern) {
        if (param.dotDotDotToken) {
          context.bytecode.emitOp(Opcode.OP_rest)
          context.bytecode.emitU16(index)
        } else {
          context.bytecode.emitOp(Opcode.OP_get_arg)
          context.bytecode.emitU16(index)
        }

        if (param.initializer) {
          const label = context.labels.newLabel()
          context.bytecode.emitOp(Opcode.OP_dup)
          context.bytecode.emitOp(Opcode.OP_undefined)
          context.bytecode.emitOp(Opcode.OP_strict_eq)
          context.labels.emitGoto(Opcode.OP_if_false, label)
          context.bytecode.emitOp(Opcode.OP_drop)
          compiler.emitExpression(param.initializer, context)
          context.labels.emitLabel(label)
        }

        this.destructuringEmitter.emitBindingPatternFromValue(param.name, context)
        return
      }

      if (!ts.isIdentifier(param.name)) return

      if (param.dotDotDotToken) {
        context.bytecode.emitOp(Opcode.OP_rest)
        context.bytecode.emitU16(index)
        context.bytecode.emitOp(Opcode.OP_put_arg)
        context.bytecode.emitU16(index)
        return
      }

      if (!param.initializer) return

      const label = context.labels.newLabel()
      context.bytecode.emitOp(Opcode.OP_get_arg)
      context.bytecode.emitU16(index)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_undefined)
      context.bytecode.emitOp(Opcode.OP_strict_eq)
      context.labels.emitGoto(Opcode.OP_if_false, label)
      context.bytecode.emitOp(Opcode.OP_drop)
      compiler.emitExpression(param.initializer, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_put_arg)
      context.bytecode.emitU16(index)
      context.labels.emitLabel(label)
    })
  }

  private ensureReturn(bytecode: BytecodeBuffer, context: EmitterContext) {
    if (bytecode.length === 0) {
      if (context.inAsync) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else {
        context.bytecode.emitOp(Opcode.OP_return_undef)
      }
      return
    }
    const snapshot = bytecode.snapshot()
    const lastOpcode = snapshot.buffer[context.bytecode.lastOpcodePos]
    if (
      lastOpcode !== Opcode.OP_return &&
      lastOpcode !== Opcode.OP_return_undef &&
      lastOpcode !== Opcode.OP_return_async
    ) {
      if (context.inAsync) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else {
        context.bytecode.emitOp(Opcode.OP_return_undef)
      }
    }
  }
}
