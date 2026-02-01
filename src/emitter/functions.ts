import ts from 'typescript'

import { DEFINE_GLOBAL_FUNC_VAR, JSVarKindEnum, Opcode, OPSpecialObjectEnum } from '../env'
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

interface SpecialVarUsage {
  usesArguments: boolean
  usesThis: boolean
  usesNewTarget: boolean
}

interface SpecialVarIndices {
  argumentsVar?: number
  thisVar?: number
  newTargetVar?: number
  argumentsMapped?: boolean
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
      inArrow: ts.isArrowFunction(node),
      inAsync: Boolean(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)),
      inGenerator: Boolean((node as ts.FunctionDeclaration | ts.FunctionExpression).asteriskToken),
      privateBindings: options.privateBindings,
    })

    context.scopes.pushScope()
    const specialUsage = this.collectSpecialVarUsage(node)
    const hasUseStrict = this.hasUseStrictDirective(node)
    const hasSimpleParameterList = this.hasSimpleParameterList(node)
    const specialVars = this.registerSpecialVariables(node, context, argMap, specialUsage, {
      hasUseStrict,
      hasSimpleParameterList,
    })
    this.registerParameterLocals(node, context)

    if (!node.body) {
      if (context.inAsync) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else {
        context.bytecode.emitOp(Opcode.OP_return_undef)
      }
      context.scopes.popScope()
      return bytecode.toUint8Array()
    }

    if (ts.isBlock(node.body)) {
      this.emitSpecialVarPrologue(specialVars, context)
      if (context.inGenerator) {
        context.bytecode.emitOp(Opcode.OP_initial_yield)
      }
      this.emitParameterInitializers(node, context, compiler)
      const restArgName = this.getRestIdentifierName(node)
      if (this.tryEmitRestReturn(node.body.statements, context, restArgName)) {
        context.scopes.popScope()
        return bytecode.toUint8Array()
      }
      compiler.compileStatements(node.body.statements, context)
      this.ensureReturn(bytecode, context)
      context.scopes.popScope()
      return bytecode.toUint8Array()
    }

    // Arrow function expression body
    this.emitSpecialVarPrologue(specialVars, context)
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
    context.scopes.popScope()
    return bytecode.toUint8Array()
  }

  private registerParameterLocals(node: ts.FunctionLikeDeclarationBase, context: EmitterContext) {
    const seen = new Set<string>()

    for (const param of node.parameters) {
      if (ts.isIdentifier(param.name)) {
        continue
      }
      this.collectBindingIdentifiers(param.name, context, seen)
    }
  }

  private collectSpecialVarUsage(node: ts.FunctionLikeDeclarationBase): SpecialVarUsage {
    const usage: SpecialVarUsage = { usesArguments: false, usesThis: false, usesNewTarget: false }
    if (!node.body) return usage

    const isIdentifierReference = (id: ts.Identifier): boolean => {
      const parent = id.parent
      if (!parent) return true
      if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false
      if (ts.isPropertyAccessChain(parent) && parent.name === id) return false
      if (ts.isBindingElement(parent) && parent.name === id) return false
      if (ts.isParameter(parent) && parent.name === id) return false
      if (ts.isVariableDeclaration(parent) && parent.name === id) return false
      if (ts.isFunctionDeclaration(parent) && parent.name === id) return false
      if (ts.isFunctionExpression(parent) && parent.name === id) return false
      if (ts.isClassDeclaration(parent) && parent.name === id) return false
      if (ts.isClassExpression(parent) && parent.name === id) return false
      if (ts.isImportClause(parent)) return false
      if (ts.isImportSpecifier(parent)) return false
      if (ts.isNamespaceImport(parent)) return false
      if (ts.isImportEqualsDeclaration(parent)) return false
      if (ts.isExportSpecifier(parent)) return false
      return true
    }

    const visit = (current: ts.Node, root: ts.Node) => {
      if (current !== root && (ts.isFunctionLike(current) || ts.isClassLike(current))) return
      if (current.kind === ts.SyntaxKind.ThisKeyword) {
        usage.usesThis = true
      }
      if (ts.isMetaProperty(current)) {
        if (current.keywordToken === ts.SyntaxKind.NewKeyword && current.name.text === 'target') {
          usage.usesNewTarget = true
        }
      }
      if (ts.isIdentifier(current) && current.text === 'arguments' && isIdentifierReference(current)) {
        usage.usesArguments = true
      }
      ts.forEachChild(current, child => visit(child, root))
    }

    visit(node.body, node.body)
    return usage
  }

  private registerSpecialVariables(
    node: ts.FunctionLikeDeclarationBase,
    context: EmitterContext,
    argMap: Map<string, number>,
    usage: SpecialVarUsage,
    options: { hasUseStrict: boolean; hasSimpleParameterList: boolean },
  ): SpecialVarIndices {
    const indices: SpecialVarIndices = {}
    if (context.inArrow) return indices

    if (usage.usesNewTarget) {
      const atom = context.getAtom('new.target')
      const index = context.scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
      context.setSpecialVar('new.target', index)
      indices.newTargetVar = index
    }

    if (usage.usesThis) {
      const atom = context.getAtom('this')
      const index = context.scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
      context.setSpecialVar('this', index)
      indices.thisVar = index
    }

    if (usage.usesArguments && !argMap.has('arguments')) {
      const atom = context.getAtom('arguments')
      const index = context.scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
      context.setSpecialVar('arguments', index)
      indices.argumentsVar = index
      indices.argumentsMapped = !options.hasUseStrict && options.hasSimpleParameterList
    }

    return indices
  }

  private emitSpecialVarPrologue(indices: SpecialVarIndices, context: EmitterContext) {
    if (indices.newTargetVar !== undefined) {
      context.bytecode.emitOp(Opcode.OP_special_object)
      context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_NEW_TARGET)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(indices.newTargetVar)
    }

    if (indices.thisVar !== undefined) {
      context.bytecode.emitOp(Opcode.OP_push_this)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(indices.thisVar)
    }

    if (indices.argumentsVar !== undefined) {
      context.bytecode.emitOp(Opcode.OP_special_object)
      context.bytecode.emitU8(
        indices.argumentsMapped
          ? OPSpecialObjectEnum.OP_SPECIAL_OBJECT_MAPPED_ARGUMENTS
          : OPSpecialObjectEnum.OP_SPECIAL_OBJECT_ARGUMENTS,
      )
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(indices.argumentsVar)
    }
  }

  private hasUseStrictDirective(node: ts.FunctionLikeDeclarationBase): boolean {
    if (!node.body || !ts.isBlock(node.body)) return false
    for (const stmt of node.body.statements) {
      if (!ts.isExpressionStatement(stmt)) return false
      const expr = stmt.expression
      if (!ts.isStringLiteral(expr)) return false
      if (expr.text === 'use strict') return true
    }
    return false
  }

  private hasSimpleParameterList(node: ts.FunctionLikeDeclarationBase): boolean {
    for (const param of node.parameters) {
      if (param.dotDotDotToken) return false
      if (param.initializer) return false
      if (!ts.isIdentifier(param.name)) return false
    }
    return true
  }

  private collectBindingIdentifiers(
    name: ts.BindingName,
    context: EmitterContext,
    seen: Set<string>,
  ) {
    if (ts.isIdentifier(name)) {
      this.registerLocalIdentifier(name, context, seen)
      return
    }

    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (!element) continue
        this.collectBindingIdentifiers(element.name, context, seen)
      }
      return
    }

    if (ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (!element) continue
        if (ts.isOmittedExpression(element)) continue
        this.collectBindingIdentifiers(element.name, context, seen)
      }
    }
  }

  private registerLocalIdentifier(name: ts.Identifier, context: EmitterContext, seen: Set<string>) {
    if (seen.has(name.text)) return
    const atom = context.getAtom(name.text)
    const scopeLevel = context.scopes.scopeLevel
    if (scopeLevel >= 0 && context.scopes.findVarInScope(atom, scopeLevel) < 0) {
      context.scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
    }
    seen.add(name.text)
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

        this.destructuringEmitter.emitBindingPatternFromValue(param.name, context, compiler.emitExpression.bind(compiler))
        return
      }

      if (!ts.isIdentifier(param.name)) return

      if (param.dotDotDotToken) {
        context.bytecode.emitOp(Opcode.OP_rest)
        context.bytecode.emitU16(index)
        this.emitSetArg(index, context)
        return
      }

      if (!param.initializer) return

      const label = context.labels.newLabel()
      context.bytecode.emitOp(Opcode.OP_get_arg)
      context.bytecode.emitU16(index)
      context.bytecode.emitOp(Opcode.OP_undefined)
      context.bytecode.emitOp(Opcode.OP_strict_eq)
      context.labels.emitGoto(Opcode.OP_if_false, label)
      compiler.emitExpression(param.initializer, context)
      context.bytecode.emitOp(Opcode.OP_put_arg)
      context.bytecode.emitU16(index)
      context.labels.emitLabel(label)
    })
  }

  private emitSetArg(index: number, context: EmitterContext) {
    switch (index) {
      case 0:
        context.bytecode.emitOp(Opcode.OP_set_arg0)
        break
      case 1:
        context.bytecode.emitOp(Opcode.OP_set_arg1)
        break
      case 2:
        context.bytecode.emitOp(Opcode.OP_set_arg2)
        break
      case 3:
        context.bytecode.emitOp(Opcode.OP_set_arg3)
        break
      default:
        context.bytecode.emitOp(Opcode.OP_set_arg)
        context.bytecode.emitU16(index)
        break
    }
  }

  private getRestIdentifierName(node: ts.FunctionLikeDeclarationBase): string | undefined {
    for (const param of node.parameters) {
      if (param.dotDotDotToken && ts.isIdentifier(param.name)) {
        return param.name.text
      }
    }
    return undefined
  }

  private tryEmitRestReturn(
    statements: ts.NodeArray<ts.Statement>,
    context: EmitterContext,
    restArgName?: string,
  ): boolean {
    if (!restArgName || statements.length !== 1) return false
    const stmt = statements[0]
    if (!ts.isReturnStatement(stmt) || !stmt.expression) return false
    if (!ts.isIdentifier(stmt.expression)) return false
    if (stmt.expression.text !== restArgName) return false

    context.emitSourcePos(stmt)
    context.bytecode.emitOp(context.inAsync ? Opcode.OP_return_async : Opcode.OP_return)
    return true
  }

  private ensureReturn(bytecode: BytecodeBuffer, context: EmitterContext) {
    if (bytecode.length === 0) {
      if (context.inAsync && context.inGenerator) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_await)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else if (context.inAsync || context.inGenerator) {
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
      if (context.inAsync && context.inGenerator) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_await)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else if (context.inAsync || context.inGenerator) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else {
        context.bytecode.emitOp(Opcode.OP_return_undef)
      }
    }
  }
}
