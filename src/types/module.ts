import type { JSValue } from './bytecode'
import type { JSAtom } from './function-def'

/**
 * JSImportEntry 结构。
 *
 * @source QuickJS/src/core/types.h:723-729
 */
export interface JSImportEntry {
  varIdx: number
  isStar: boolean
  importName: JSAtom
  reqModuleIdx: number
}

/**
 * JSExportTypeEnum 枚举。
 *
 * @source QuickJS/src/core/types.h:730-733
 */
export enum JSExportTypeEnum {
  JS_EXPORT_TYPE_LOCAL = 0,
  JS_EXPORT_TYPE_INDIRECT = 1,
}

/**
 * JSExportEntry 结构。
 *
 * @source QuickJS/src/core/types.h:735-747
 */
export interface JSExportEntry {
  u:
    | { local: { varIdx: number; varRef: JSVarRef | null } }
    | { reqModuleIdx: number }
  exportType: JSExportTypeEnum
  localName: JSAtom
  exportName: JSAtom
}

/**
 * JSStarExportEntry 结构。
 *
 * @source QuickJS/src/core/types.h:547-549
 */
export interface JSStarExportEntry {
  reqModuleIdx: number
}

/**
 * JSReqModuleEntry 结构。
 *
 * @source QuickJS/src/core/types.h:551-555
 */
export interface JSReqModuleEntry {
  moduleName: JSAtom
  module: JSModuleDef | null
  attributes: JSValue
}

/**
 * JSModuleStatus 枚举。
 *
 * @source QuickJS/src/core/types.h:748-756
 */
export enum JSModuleStatus {
  JS_MODULE_STATUS_UNLINKED = 0,
  JS_MODULE_STATUS_LINKING = 1,
  JS_MODULE_STATUS_LINKED = 2,
  JS_MODULE_STATUS_EVALUATING = 3,
  JS_MODULE_STATUS_EVALUATING_ASYNC = 4,
  JS_MODULE_STATUS_EVALUATED = 5,
}

/**
 * JSModuleDef 结构。
 *
 * @source QuickJS/src/core/types.h:758-810
 */
export interface JSModuleDef {
  header: unknown
  moduleName: JSAtom
  link: unknown

  reqModuleEntries: JSReqModuleEntry[]
  reqModuleEntriesCount: number
  reqModuleEntriesSize: number

  exportEntries: JSExportEntry[]
  exportEntriesCount: number
  exportEntriesSize: number

  starExportEntries: JSStarExportEntry[]
  starExportEntriesCount: number
  starExportEntriesSize: number

  importEntries: JSImportEntry[]
  importEntriesCount: number
  importEntriesSize: number

  moduleNs: JSValue
  funcObj: JSValue
  initFunc: JSModuleInitFunc | null
  initDataFunc: JSModuleInitDataFunc | null
  hasTla: boolean
  resolved: boolean
  funcCreated: boolean
  status: JSModuleStatus
  dfsIndex: number
  dfsAncestorIndex: number
  stackPrev: JSModuleDef | null
  asyncParentModules: Array<JSModuleDef | null>
  asyncParentModulesCount: number
  asyncParentModulesSize: number
  pendingAsyncDependencies: number
  asyncEvaluation: boolean
  asyncEvaluationTimestamp: number
  cycleRoot: JSModuleDef | null
  instantiated: boolean
  evaluated: boolean
  evalMark: boolean
  promise: JSValue
  resolvingFuncs: [JSValue, JSValue]
  evalHasException: boolean
  evalException: JSValue
  metaObj: JSValue
  privateValue: JSValue
  initDataOpaque: unknown
}

/**
 * JSVarRef 占位类型。
 *
 * @source QuickJS/src/core/types.h:600-660
 */
export interface JSVarRef {
  header: unknown
  pvalue: JSValue | null
  value: JSValue
  isDetachable: boolean
  varIdx: number
  valueReleased: boolean
  varName: JSAtom
  next: JSVarRef | null
}

/**
 * JSModuleInitFunc 类型占位。
 *
 * @source QuickJS/src/core/module.c:1-80
 */
export type JSModuleInitFunc = (ctx: unknown, m: JSModuleDef) => number

/**
 * JSModuleInitDataFunc 类型占位。
 *
 * @source QuickJS/src/core/module.c:80-120
 */
export type JSModuleInitDataFunc = (ctx: unknown, m: JSModuleDef, data: JSValue) => number
