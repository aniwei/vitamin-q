import ts from 'typescript'

import {
  JS_DEFINE_CLASS_HAS_HERITAGE,
  OP_DEFINE_METHOD_GETTER,
  OP_DEFINE_METHOD_METHOD,
  OP_DEFINE_METHOD_SETTER,
  OPSpecialObjectEnum,
  Opcode,
} from '../env'
import type { EmitterContext } from './emitter'
import { BytecodeBuffer } from './bytecode-buffer'
import { ConstantPoolManager } from './constant-pool'
import { InlineCacheManager } from './inline-cache'
import { BytecodeCompiler, EmitterContext as FunctionContext } from './emitter'
import { FunctionEmitter, type FunctionTemplate } from './functions'

export type ClassExpressionEmitterFn = (node: ts.Expression, context: EmitterContext) => void

interface ClassMethodDef {
  node: ts.MethodDeclaration
  name: ts.PropertyName | ts.PrivateIdentifier
  isStatic: boolean
  isComputed: boolean
}

interface ClassAccessorDef {
  node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
  name: ts.PropertyName | ts.PrivateIdentifier
  isStatic: boolean
  isComputed: boolean
  isSetter: boolean
}

interface ClassFieldDef {
  node: ts.PropertyDeclaration
  name: ts.PropertyName | ts.PrivateIdentifier
  isStatic: boolean
  isComputed: boolean
}

interface ClassStaticBlockDef {
  node: ts.ClassStaticBlockDeclaration
}

interface PrivateBinding {
  name: string
  local: number
  isStatic: boolean
  kind: 'field' | 'method' | 'accessor'
  node?: ts.FunctionLikeDeclarationBase
}

/**
 * 类发射器（最小实现：构造函数 + 普通方法）。
 *
 * @source QuickJS/src/core/parser.c:3230-3740
 * @see js_parse_class
 */
export class ClassEmitter {
  private functionEmitter = new FunctionEmitter()

  emitClassDeclaration(
    node: ts.ClassDeclaration,
    context: EmitterContext,
    emitExpression: ClassExpressionEmitterFn,
  ) {
    if (!node.name || !ts.isIdentifier(node.name)) {
      throw new Error('类声明必须包含标识符名称')
    }
    this.emitClass(node, context, emitExpression, { declarationName: node.name.text })
  }

  emitClassExpression(
    node: ts.ClassExpression,
    context: EmitterContext,
    emitExpression: ClassExpressionEmitterFn,
  ) {
    this.emitClass(node, context, emitExpression, { declarationName: undefined })
  }

  private emitClass(
    node: ts.ClassLikeDeclaration,
    context: EmitterContext,
    emitExpression: ClassExpressionEmitterFn,
    options: { declarationName?: string },
  ) {
    context.emitSourcePos(node)

    const heritage = node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
    const isDerived = Boolean(heritage && heritage.types.length > 0)
    const className = node.name && ts.isIdentifier(node.name) ? node.name.text : options.declarationName
    const classAtom = className ? context.getAtom(className) : context.getAtom('')
    const classFlags = isDerived ? JS_DEFINE_CLASS_HAS_HERITAGE : 0

    const classNameLoc = className ? context.allocateTempLocal() : -1
    const classFieldsLoc = context.allocateTempLocal()

    const { methods, accessors, fields, staticBlocks, privateBindings } = this.collectMembers(node)
    const computedInstanceFields = fields.filter(field => !field.isStatic && field.isComputed)
    const computedStaticFields = fields.filter(field => field.isStatic && field.isComputed)

    const computedInstanceLocals = new Map<ClassFieldDef, number>()
    const computedStaticLocals = new Map<ClassFieldDef, number>()
    const privateBindingInfo = new Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }>()

    for (const field of computedStaticFields) {
      computedStaticLocals.set(field, context.allocateTempLocal())
    }
    for (const field of computedInstanceFields) {
      computedInstanceLocals.set(field, context.allocateTempLocal())
    }

    let privateIndex = 0
    for (const binding of privateBindings) {
      binding.local = context.allocateTempLocal()
      if (!privateBindingInfo.has(binding.name)) {
        privateBindingInfo.set(binding.name, { index: privateIndex, kind: binding.kind })
        privateIndex += 1
      }
    }

    if (classNameLoc >= 0) {
      context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      context.bytecode.emitU16(classNameLoc)
    }

    if (isDerived && heritage?.types[0]) {
      emitExpression(heritage.types[0].expression, context)
    } else {
      context.bytecode.emitOp(Opcode.OP_undefined)
    }

    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
    context.bytecode.emitU16(classFieldsLoc)

    for (const binding of privateBindings) {
      context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      context.bytecode.emitU16(binding.local)
    }

    for (const field of computedStaticFields) {
      const local = computedStaticLocals.get(field) ?? -1
      context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      context.bytecode.emitU16(local)
    }

    for (const field of computedInstanceFields) {
      const local = computedInstanceLocals.get(field) ?? -1
      context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      context.bytecode.emitU16(local)
    }

    const ctorTemplate = this.getConstructorTemplate(node, context, isDerived, privateBindingInfo)
    const ctorIndex = context.constantPool.add(ctorTemplate)
    context.bytecode.emitOp(Opcode.OP_push_const)
    context.bytecode.emitU32(ctorIndex)

    context.bytecode.emitOp(Opcode.OP_define_class)
    context.bytecode.emitAtom(classAtom)
    context.bytecode.emitU8(classFlags)

    for (const field of computedInstanceFields) {
      const local = computedInstanceLocals.get(field) ?? -1
      emitExpression(this.getComputedNameExpression(field.name), context)
      context.bytecode.emitOp(Opcode.OP_to_propkey)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(local)
      context.bytecode.emitOp(Opcode.OP_swap)
    }

    for (const field of computedStaticFields) {
      const local = computedStaticLocals.get(field) ?? -1
      context.bytecode.emitOp(Opcode.OP_swap)
      emitExpression(this.getComputedNameExpression(field.name), context)
      context.bytecode.emitOp(Opcode.OP_to_propkey)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(local)
      context.bytecode.emitOp(Opcode.OP_swap)
    }

    for (const binding of privateBindings) {
      if (binding.kind === 'field') {
        context.bytecode.emitOp(Opcode.OP_private_symbol)
        context.bytecode.emitAtom(context.getAtom(binding.name))
        context.bytecode.emitOp(Opcode.OP_put_loc)
        context.bytecode.emitU16(binding.local)
      }
    }

    for (const binding of privateBindings) {
      if (binding.kind !== 'method' && binding.kind !== 'accessor') continue
      if (!binding.node) continue
      this.functionEmitter.emitFunctionClosure(binding.node, context, { privateBindings: privateBindingInfo })
      context.bytecode.emitOp(Opcode.OP_set_home_object)
      context.bytecode.emitOp(Opcode.OP_set_name)
      context.bytecode.emitAtom(context.getAtom(binding.name))
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(binding.local)
    }

    for (const method of methods) {
      if (method.isStatic) {
        context.bytecode.emitOp(Opcode.OP_swap)
      }
      this.functionEmitter.emitFunctionClosure(method.node, context, { privateBindings: privateBindingInfo })
      if (method.isComputed) {
        context.bytecode.emitOp(Opcode.OP_define_method_computed)
      } else {
        context.bytecode.emitOp(Opcode.OP_define_method)
        context.bytecode.emitAtom(context.getAtom(this.getPropertyName(method.name)))
      }
      context.bytecode.emitU8(OP_DEFINE_METHOD_METHOD)
      if (method.isStatic) {
        context.bytecode.emitOp(Opcode.OP_swap)
      }
    }

    for (const accessor of accessors) {
      if (accessor.isStatic) {
        context.bytecode.emitOp(Opcode.OP_swap)
      }
      this.functionEmitter.emitFunctionClosure(accessor.node, context, { privateBindings: privateBindingInfo })
      if (accessor.isComputed) {
        context.bytecode.emitOp(Opcode.OP_define_method_computed)
      } else {
        context.bytecode.emitOp(Opcode.OP_define_method)
        context.bytecode.emitAtom(context.getAtom(this.getPropertyName(accessor.name)))
      }
      context.bytecode.emitU8(accessor.isSetter ? OP_DEFINE_METHOD_SETTER : OP_DEFINE_METHOD_GETTER)
      if (accessor.isStatic) {
        context.bytecode.emitOp(Opcode.OP_swap)
      }
    }

    const needsBrand = privateBindings.some(binding => !binding.isStatic && binding.kind !== 'field')
    if (needsBrand) {
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_null)
      context.bytecode.emitOp(Opcode.OP_swap)
      context.bytecode.emitOp(Opcode.OP_add_brand)
    }

    const instanceFields = fields.filter(field => !field.isStatic)
    if (instanceFields.length > 0 || needsBrand) {
      const template = this.buildFieldsInitTemplate(instanceFields, context, emitExpression, {
        isStatic: false,
        privateBindings,
      })
      const idx = context.constantPool.add(template)
      context.bytecode.emitOp(Opcode.OP_fclosure)
      context.bytecode.emitU32(idx)
      context.bytecode.emitOp(Opcode.OP_set_home_object)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(classFieldsLoc)
    } else {
      context.bytecode.emitOp(Opcode.OP_undefined)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(classFieldsLoc)
    }
    context.bytecode.emitOp(Opcode.OP_drop)

    if (classNameLoc >= 0) {
      context.bytecode.emitOp(Opcode.OP_set_loc)
      context.bytecode.emitU16(classNameLoc)
    }

    const staticFields = fields.filter(field => field.isStatic)
    if (staticFields.length > 0 || staticBlocks.length > 0) {
      const staticTemplate = this.buildFieldsInitTemplate(staticFields, context, emitExpression, {
        isStatic: true,
        privateBindings,
        staticBlocks,
      })
      const idx = context.constantPool.add(staticTemplate)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_fclosure)
      context.bytecode.emitU32(idx)
      context.bytecode.emitOp(Opcode.OP_set_home_object)
      context.bytecode.emitOp(Opcode.OP_call_method)
      context.bytecode.emitU16(0)
      context.bytecode.emitOp(Opcode.OP_drop)
    }

    const staticNeedsBrand = privateBindings.some(binding => binding.isStatic)
    if (staticNeedsBrand) {
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_add_brand)
    }

    context.bytecode.emitOp(Opcode.OP_close_loc)
    context.bytecode.emitU16(classFieldsLoc)

    for (const field of computedStaticFields) {
      const local = computedStaticLocals.get(field) ?? -1
      context.bytecode.emitOp(Opcode.OP_close_loc)
      context.bytecode.emitU16(local)
    }

    for (const field of computedInstanceFields) {
      const local = computedInstanceLocals.get(field) ?? -1
      context.bytecode.emitOp(Opcode.OP_close_loc)
      context.bytecode.emitU16(local)
    }

    for (const binding of privateBindings) {
      if (binding.kind !== 'field') continue
      context.bytecode.emitOp(Opcode.OP_close_loc)
      context.bytecode.emitU16(binding.local)
    }

    if (options.declarationName) {
      context.bytecode.emitOp(Opcode.OP_put_var_init)
      context.bytecode.emitAtom(context.getAtom(options.declarationName))
    } else {
      context.bytecode.emitOp(Opcode.OP_drop)
    }
  }

  private getConstructorTemplate(
    node: ts.ClassLikeDeclaration,
    context: EmitterContext,
    isDerived: boolean,
    privateBindings: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }>,
  ): FunctionTemplate {
    const ctor = node.members.find(member => ts.isConstructorDeclaration(member))
    if (ctor && ts.isConstructorDeclaration(ctor)) {
      return this.buildConstructorTemplate(ctor, context, isDerived, privateBindings)
    }
    return this.buildDefaultConstructorTemplate(context, isDerived)
  }

  private collectMembers(node: ts.ClassLikeDeclaration) {
    const methods: ClassMethodDef[] = []
    const accessors: ClassAccessorDef[] = []
    const fields: ClassFieldDef[] = []
    const staticBlocks: ClassStaticBlockDef[] = []
    const privateBindings: PrivateBinding[] = []

    for (const member of node.members) {
      if (ts.isConstructorDeclaration(member)) continue
      if (ts.isClassStaticBlockDeclaration(member)) {
        staticBlocks.push({ node: member })
        continue
      }
      if (ts.isMethodDeclaration(member)) {
        const isStatic = Boolean(member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword))
        const isComputed = ts.isComputedPropertyName(member.name)
        if (ts.isPrivateIdentifier(member.name)) {
          privateBindings.push({
            name: member.name.text,
            local: -1,
            isStatic,
            kind: 'method',
            node: member as ts.MethodDeclaration,
          } as PrivateBinding & { node: ts.MethodDeclaration })
        } else {
          methods.push({ node: member, name: member.name, isStatic, isComputed })
        }
        continue
      }
      if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
        const isStatic = Boolean(member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword))
        const isComputed = ts.isComputedPropertyName(member.name)
        const isSetter = ts.isSetAccessorDeclaration(member)
        if (ts.isPrivateIdentifier(member.name)) {
          privateBindings.push({
            name: member.name.text,
            local: -1,
            isStatic,
            kind: 'accessor',
            node: member,
          } as PrivateBinding & { node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration })
        } else {
          accessors.push({ node: member, name: member.name, isStatic, isComputed, isSetter })
        }
        continue
      }
      if (ts.isPropertyDeclaration(member)) {
        const isStatic = Boolean(member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword))
        const isComputed = ts.isComputedPropertyName(member.name)
        if (ts.isPrivateIdentifier(member.name)) {
          privateBindings.push({
            name: member.name.text,
            local: -1,
            isStatic,
            kind: 'field',
          })
        }
        fields.push({ node: member, name: member.name, isStatic, isComputed })
      }
    }

    return { methods, accessors, fields, staticBlocks, privateBindings }
  }

  private buildDefaultConstructorTemplate(context: EmitterContext, isDerived: boolean): FunctionTemplate {
    const bytecode = new BytecodeBuffer()
    const inlineCache = new InlineCacheManager()
    const constantPool = new ConstantPoolManager()
    const ctorContext = new FunctionContext({
      sourceFile: context.sourceFile,
      atomTable: context.atomTable,
      inlineCache,
      constantPool,
      bytecode,
      inFunction: true,
    })

    if (isDerived) {
      ctorContext.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_init_ctor)
      ctorContext.bytecode.emitOp(Opcode.OP_put_loc_check_init)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_get_var_ref_check)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_dup)
      const label = ctorContext.labels.emitGoto(Opcode.OP_if_false, -1)
      ctorContext.bytecode.emitOp(Opcode.OP_get_loc_check)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_swap)
      ctorContext.bytecode.emitOp(Opcode.OP_call_method)
      ctorContext.bytecode.emitU16(0)
      ctorContext.labels.emitLabel(label)
      ctorContext.bytecode.emitOp(Opcode.OP_drop)
      ctorContext.bytecode.emitOp(Opcode.OP_get_loc_checkthis)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_return)
    } else {
      ctorContext.bytecode.emitOp(Opcode.OP_push_this)
      ctorContext.bytecode.emitOp(Opcode.OP_put_loc0)
      ctorContext.bytecode.emitOp(Opcode.OP_check_ctor)
      ctorContext.bytecode.emitOp(Opcode.OP_get_var_ref_check)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_dup)
      const label = ctorContext.labels.emitGoto(Opcode.OP_if_false, -1)
      ctorContext.bytecode.emitOp(Opcode.OP_get_loc0)
      ctorContext.bytecode.emitOp(Opcode.OP_swap)
      ctorContext.bytecode.emitOp(Opcode.OP_call_method)
      ctorContext.bytecode.emitU16(0)
      ctorContext.labels.emitLabel(label)
      ctorContext.bytecode.emitOp(Opcode.OP_return_undef)
    }
    return {
      kind: 'function',
      name: undefined,
      params: [],
      isArrow: false,
      isAsync: false,
      isGenerator: false,
      bodyText: '',
      bytecode: bytecode.toUint8Array(),
    }
  }

  private buildConstructorTemplate(
    ctor: ts.ConstructorDeclaration,
    context: EmitterContext,
    isDerived: boolean,
    privateBindings: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }>,
  ): FunctionTemplate {
    const bytecode = new BytecodeBuffer()
    const inlineCache = new InlineCacheManager()
    const constantPool = new ConstantPoolManager()
    const compiler = new BytecodeCompiler({
      atomTable: context.atomTable,
      inlineCache,
      constantPool,
      bytecode,
      expressionStatementDrop: true,
    })
    const ctorContext = new FunctionContext({
      sourceFile: context.sourceFile,
      atomTable: context.atomTable,
      inlineCache,
      constantPool,
      bytecode,
      inFunction: true,
      privateBindings,
    })

    if (isDerived) {
      ctorContext.bytecode.emitOp(Opcode.OP_special_object)
      ctorContext.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_THIS_FUNC)
      ctorContext.bytecode.emitOp(Opcode.OP_put_loc)
      ctorContext.bytecode.emitU16(0)
      ctorContext.bytecode.emitOp(Opcode.OP_special_object)
      ctorContext.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_NEW_TARGET)
      ctorContext.bytecode.emitOp(Opcode.OP_put_loc)
      ctorContext.bytecode.emitU16(1)
      ctorContext.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      ctorContext.bytecode.emitU16(2)
      ctorContext.bytecode.emitOp(Opcode.OP_check_ctor)
    } else {
      ctorContext.bytecode.emitOp(Opcode.OP_push_this)
      ctorContext.bytecode.emitOp(Opcode.OP_put_loc0)
      ctorContext.bytecode.emitOp(Opcode.OP_check_ctor)
    }

    ctorContext.bytecode.emitOp(Opcode.OP_get_var_ref_check)
    ctorContext.bytecode.emitU16(0)
    ctorContext.bytecode.emitOp(Opcode.OP_dup)
    const label = ctorContext.labels.emitGoto(Opcode.OP_if_false, -1)
    if (isDerived) {
      ctorContext.bytecode.emitOp(Opcode.OP_get_loc_check)
      ctorContext.bytecode.emitU16(2)
    } else {
      ctorContext.bytecode.emitOp(Opcode.OP_get_loc0)
    }
    ctorContext.bytecode.emitOp(Opcode.OP_swap)
    ctorContext.bytecode.emitOp(Opcode.OP_call_method)
    ctorContext.bytecode.emitU16(0)
    ctorContext.labels.emitLabel(label)

    if (ctor.body) {
      compiler.compileStatements(ctor.body.statements, ctorContext)
    }

    if (isDerived) {
      ctorContext.bytecode.emitOp(Opcode.OP_get_loc_checkthis)
      ctorContext.bytecode.emitU16(2)
      ctorContext.bytecode.emitOp(Opcode.OP_return)
    } else {
      ctorContext.bytecode.emitOp(Opcode.OP_return_undef)
    }

    return {
      kind: 'function',
      name: undefined,
      params: ctor.parameters.map(param => param.name.getText(context.sourceFile)),
      isArrow: false,
      isAsync: false,
      isGenerator: false,
      bodyText: ctor.body?.getText(context.sourceFile) ?? '',
      bytecode: bytecode.toUint8Array(),
    }
  }

  private buildFieldsInitTemplate(
    fields: ClassFieldDef[],
    context: EmitterContext,
    emitExpression: ClassExpressionEmitterFn,
    options: { isStatic: boolean; privateBindings: PrivateBinding[]; staticBlocks?: ClassStaticBlockDef[] },
  ): FunctionTemplate {
    const bytecode = new BytecodeBuffer()
    const inlineCache = new InlineCacheManager()
    const constantPool = new ConstantPoolManager()
    const compiler = new BytecodeCompiler({
      atomTable: context.atomTable,
      inlineCache,
      constantPool,
      bytecode,
      expressionStatementDrop: true,
    })
    const initContext = new FunctionContext({
      sourceFile: context.sourceFile,
      atomTable: context.atomTable,
      inlineCache,
      constantPool,
      bytecode,
      inFunction: true,
    })

    if (!options.isStatic) {
      initContext.bytecode.emitOp(Opcode.OP_special_object)
      initContext.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_HOME_OBJECT)
      initContext.bytecode.emitOp(Opcode.OP_put_loc1)
    }

    initContext.bytecode.emitOp(Opcode.OP_push_this)
    initContext.bytecode.emitOp(Opcode.OP_put_loc0)

    let brandAdded = false
    for (const field of fields) {
      initContext.bytecode.emitOp(Opcode.OP_get_loc0)
      if (ts.isPrivateIdentifier(field.name)) {
        if (!options.isStatic && !brandAdded) {
          initContext.bytecode.emitOp(Opcode.OP_get_loc0)
          initContext.bytecode.emitOp(Opcode.OP_get_loc1)
          initContext.bytecode.emitOp(Opcode.OP_add_brand)
          brandAdded = true
        }
        initContext.bytecode.emitOp(Opcode.OP_get_var_ref_check)
        initContext.bytecode.emitU16(0)
      } else if (field.isComputed) {
        initContext.bytecode.emitOp(Opcode.OP_get_var_ref_check)
        initContext.bytecode.emitU16(0)
      }

      if (field.node.initializer) {
        emitExpression(field.node.initializer, initContext)
      } else {
        initContext.bytecode.emitOp(Opcode.OP_undefined)
      }

      if (ts.isPrivateIdentifier(field.name)) {
        initContext.bytecode.emitOp(Opcode.OP_define_private_field)
      } else if (field.isComputed) {
        initContext.bytecode.emitOp(Opcode.OP_define_array_el)
      } else {
        initContext.bytecode.emitOp(Opcode.OP_define_field)
        initContext.bytecode.emitAtom(context.getAtom(this.getPropertyName(field.name)))
      }
    }

    for (const block of options.staticBlocks ?? []) {
      compiler.compileStatements(block.node.body.statements, initContext)
    }

    initContext.bytecode.emitOp(Opcode.OP_return_undef)

    return {
      kind: 'function',
      name: undefined,
      params: [],
      isArrow: false,
      isAsync: false,
      isGenerator: false,
      bodyText: '',
      bytecode: bytecode.toUint8Array(),
    }
  }

  private getPropertyName(name: ts.PropertyName | ts.PrivateIdentifier): string {
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
    throw new Error('暂不支持复杂属性名')
  }

  private getComputedNameExpression(name: ts.PropertyName | ts.PrivateIdentifier): ts.Expression {
    if (ts.isComputedPropertyName(name)) {
      return name.expression
    }
    throw new Error('不是计算属性')
  }
}