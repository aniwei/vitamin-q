import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import ts from 'typescript'

import { QuickJSLib } from '../../../scripts/QuickJSLib'

type LayoutField = { name: string; offset: number; size: number }

type InterfaceMap = Record<string, Set<string>>

type LayoutSpec = {
  name: string
  filePath: string
  interfaceName: string
  layoutProvider: () => Promise<LayoutField[]>
}

const repoRoot = process.cwd()

const layoutSpecs: LayoutSpec[] = [
  {
    name: 'BlockEnv',
    filePath: `${repoRoot}/src/types/function-def.ts`,
    interfaceName: 'BlockEnv',
    layoutProvider: () => QuickJSLib.getBlockEnvLayout(),
  },
  {
    name: 'JSFunctionDef',
    filePath: `${repoRoot}/src/types/function-def.ts`,
    interfaceName: 'JSFunctionDef',
    layoutProvider: () => QuickJSLib.getFunctionDefLayout(),
  },
  {
    name: 'JSVarDef',
    filePath: `${repoRoot}/src/types/function-def.ts`,
    interfaceName: 'JSVarDef',
    layoutProvider: () => QuickJSLib.getVarDefLayout(),
  },
  {
    name: 'JSVarScope',
    filePath: `${repoRoot}/src/types/function-def.ts`,
    interfaceName: 'JSVarScope',
    layoutProvider: () => QuickJSLib.getVarScopeLayout(),
  },
  {
    name: 'JSClosureVar',
    filePath: `${repoRoot}/src/types/function-def.ts`,
    interfaceName: 'JSClosureVar',
    layoutProvider: () => QuickJSLib.getClosureVarLayout(),
  },
  {
    name: 'JSGlobalVar',
    filePath: `${repoRoot}/src/types/function-def.ts`,
    interfaceName: 'JSGlobalVar',
    layoutProvider: () => QuickJSLib.getGlobalVarLayout(),
  },
  {
    name: 'JSFunctionBytecode',
    filePath: `${repoRoot}/src/types/function-bytecode.ts`,
    interfaceName: 'JSFunctionBytecode',
    layoutProvider: () => QuickJSLib.getFunctionBytecodeLayout(),
  },
  {
    name: 'JSModuleDef',
    filePath: `${repoRoot}/src/types/module.ts`,
    interfaceName: 'JSModuleDef',
    layoutProvider: () => QuickJSLib.getModuleDefLayout(),
  },
  {
    name: 'JSImportEntry',
    filePath: `${repoRoot}/src/types/module.ts`,
    interfaceName: 'JSImportEntry',
    layoutProvider: () => QuickJSLib.getImportEntryLayout(),
  },
  {
    name: 'JSExportEntry',
    filePath: `${repoRoot}/src/types/module.ts`,
    interfaceName: 'JSExportEntry',
    layoutProvider: () => QuickJSLib.getExportEntryLayout(),
  },
  {
    name: 'JSStarExportEntry',
    filePath: `${repoRoot}/src/types/module.ts`,
    interfaceName: 'JSStarExportEntry',
    layoutProvider: () => QuickJSLib.getStarExportEntryLayout(),
  },
  {
    name: 'JSReqModuleEntry',
    filePath: `${repoRoot}/src/types/module.ts`,
    interfaceName: 'JSReqModuleEntry',
    layoutProvider: () => QuickJSLib.getReqModuleEntryLayout(),
  },
]

const overrides: Record<string, string> = {
  label_name: 'labelName',
  label_break: 'labelBreak',
  label_cont: 'labelCont',
  drop_count: 'dropCount',
  label_finally: 'labelFinally',
  scope_level: 'scopeLevel',
  scope_next: 'scopeNext',
  var_name: 'varName',
  parent_cpool_idx: 'parentCpoolIdx',
  parent_scope_level: 'parentScopeLevel',
  child_list: 'childList',
  last_opcode_pos: 'lastOpcodePos',
  last_opcode_source_ptr: 'lastOpcodeSourcePtr',
  use_short_opcodes: 'useShortOpcodes',
  label_slots: 'labelSlots',
  line_number_slots: 'lineNumberSlots',
  line_number_size: 'lineNumberSize',
  line_number_count: 'lineNumberCount',
  line_number_last: 'lineNumberLast',
  line_number_last_pc: 'lineNumberLastPc',
  column_number_slots: 'columnNumberSlots',
  column_number_size: 'columnNumberSize',
  column_number_count: 'columnNumberCount',
  column_number_last: 'columnNumberLast',
  column_number_last_pc: 'columnNumberLastPc',
  get_line_col_cache: 'getLineColCache',
  source_len: 'sourceLen',
  has_await: 'hasAwait',
  global_var_count: 'globalVarCount',
  global_var_size: 'globalVarSize',
  global_vars: 'globalVars',
  def_scope_array: 'defScopeArray',
  arg_count: 'argCount',
  arg_size: 'argSize',
  defined_arg_count: 'definedArgCount',
  var_object_idx: 'varObjectIdx',
  arg_var_object_idx: 'argVarObjectIdx',
  arguments_var_idx: 'argumentsVarIdx',
  arguments_arg_idx: 'argumentsArgIdx',
  func_var_idx: 'funcVarIdx',
  eval_ret_idx: 'evalRetIdx',
  this_var_idx: 'thisVarIdx',
  new_target_var_idx: 'newTargetVarIdx',
  this_active_func_var_idx: 'thisActiveFuncVarIdx',
  home_object_var_idx: 'homeObjectVarIdx',
  need_home_object: 'needHomeObject',
  byte_code_buf: 'byteCodeBuf',
  byte_code_len: 'byteCodeLen',
  func_name: 'funcName',
  closure_var: 'closureVar',
  closure_var_count: 'closureVarCount',
  cpool_count: 'cpoolCount',
  cpool_size: 'cpoolSize',
  jump_slots: 'jumpSlots',
  jump_size: 'jumpSize',
  jump_count: 'jumpCount',
  module_name: 'moduleName',
  req_module_entries: 'reqModuleEntries',
  req_module_entries_count: 'reqModuleEntriesCount',
  req_module_entries_size: 'reqModuleEntriesSize',
  export_entries: 'exportEntries',
  export_entries_count: 'exportEntriesCount',
  export_entries_size: 'exportEntriesSize',
  star_export_entries: 'starExportEntries',
  star_export_entries_count: 'starExportEntriesCount',
  star_export_entries_size: 'starExportEntriesSize',
  import_entries: 'importEntries',
  import_entries_count: 'importEntriesCount',
  import_entries_size: 'importEntriesSize',
  module_ns: 'moduleNs',
  func_obj: 'funcObj',
  init_func: 'initFunc',
  init_data_func: 'initDataFunc',
  dfs_index: 'dfsIndex',
  dfs_ancestor_index: 'dfsAncestorIndex',
  stack_prev: 'stackPrev',
  async_parent_modules: 'asyncParentModules',
  async_parent_modules_count: 'asyncParentModulesCount',
  async_parent_modules_size: 'asyncParentModulesSize',
  pending_async_dependencies: 'pendingAsyncDependencies',
  async_evaluation_timestamp: 'asyncEvaluationTimestamp',
  cycle_root: 'cycleRoot',
  resolving_funcs: 'resolvingFuncs',
  eval_exception: 'evalException',
  meta_obj: 'metaObj',
  private_value: 'privateValue',
  init_data_opaque: 'initDataOpaque',
  js_mode: 'jsMode',
}

const toCamel = (name: string): string =>
  name.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

const mapCFieldToTs = (name: string): string => overrides[name] ?? toCamel(name)

const sourceCache = new Map<string, ts.SourceFile>()

const loadSourceFile = (filePath: string): ts.SourceFile => {
  const cached = sourceCache.get(filePath)
  if (cached) return cached
  const content = fs.readFileSync(filePath, 'utf8')
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2020, true)
  sourceCache.set(filePath, source)
  return source
}

const collectInterfaceProps = (filePath: string, interfaceName: string): Set<string> => {
  const source = loadSourceFile(filePath)

  const props = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          props.add(member.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(props.size > 0, `${interfaceName} 未找到属性`)
  return props
}

test('layout contract: TS 接口字段覆盖 WASM 布局', async () => {
  const interfaceCache: InterfaceMap = {}

  for (const spec of layoutSpecs) {
    if (!interfaceCache[spec.interfaceName]) {
      interfaceCache[spec.interfaceName] = collectInterfaceProps(spec.filePath, spec.interfaceName)
    }
    const tsProps = interfaceCache[spec.interfaceName]
    const layout = await spec.layoutProvider()
    const missing: string[] = []

    for (const field of layout) {
      if (field.name === '__size__') continue
      const tsName = mapCFieldToTs(field.name)
      if (!tsProps.has(tsName)) {
        missing.push(`${spec.interfaceName}.${tsName} (from ${field.name})`)
      }
    }

    assert.equal(missing.length, 0, `${spec.name} 缺少字段: ${missing.join(', ')}`)
  }
})
