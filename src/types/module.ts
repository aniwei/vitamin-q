import type { JSAtom } from './function-def'

/**
 * @source types.h: JSImportEntry
 */
export interface JSImportEntry {
  varIdx: number
  isStar: boolean
  importName: JSAtom
  reqModuleIdx: number
}

/**
 * @source types.h: JSExportTypeEnum
 */
export enum JSExportTypeEnum {
  JS_EXPORT_TYPE_LOCAL,
  JS_EXPORT_TYPE_INDIRECT,
}

/**
 * @source types.h: JSExportEntry
 */
export interface JSExportEntry {
  u: {
    local?: {
      varIdx: number
      varRef: unknown | null
    }
    reqModuleIdx?: number
  }
  exportType: JSExportTypeEnum
  localName: JSAtom
  exportName: JSAtom
}

/**
 * @source types.h: JSStarExportEntry
 */
export interface JSStarExportEntry {
  reqModuleIdx: number
}

/**
 * @source types.h: JSReqModuleEntry
 */
export interface JSReqModuleEntry {
  moduleName: JSAtom
  module: unknown | null
  attributes: unknown
}

/**
 * @source types.h: JSModuleStatus
 */
export enum JSModuleStatus {
  JS_MODULE_STATUS_UNLINKED,
  JS_MODULE_STATUS_LINKING,
  JS_MODULE_STATUS_LINKED,
  JS_MODULE_STATUS_EVALUATING,
  JS_MODULE_STATUS_EVALUATING_ASYNC,
  JS_MODULE_STATUS_EVALUATED,
}

/**
 * @source types.h: JSModuleDef
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

  moduleNs: unknown
  funcObj: unknown
  initFunc: unknown
  initDataFunc: unknown
  hasTla: boolean
  resolved: boolean
  funcCreated: boolean
  status: JSModuleStatus
  dfsIndex: number
  dfsAncestorIndex: number
  stackPrev: JSModuleDef | null
  asyncParentModules: JSModuleDef[]
  asyncParentModulesCount: number
  asyncParentModulesSize: number
  pendingAsyncDependencies: number
  asyncEvaluation: boolean
  asyncEvaluationTimestamp: number
  cycleRoot: JSModuleDef | null
  instantiated: boolean
  evaluated: boolean
  evalMark: boolean
  promise: unknown
  resolvingFuncs: [unknown, unknown]

  evalHasException: boolean
  evalException: unknown
  metaObj: unknown
  privateValue: unknown

  initDataOpaque: unknown
}
