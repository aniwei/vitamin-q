import type { JSValue } from '../types/bytecode'
import type { JSAtom } from '../types/function-def'
import { JSExportTypeEnum } from '../types/module'
import type { JSImportEntry, JSExportEntry, JSReqModuleEntry, JSStarExportEntry } from '../types/module'

export interface ModuleEntriesState {
  reqModuleEntries: JSReqModuleEntry[]
  importEntries: JSImportEntry[]
  exportEntries: JSExportEntry[]
  starExportEntries: JSStarExportEntry[]
}

/**
 * 模块条目集合（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:14060-14180
 * @see add_export_entry2
 */
export const createModuleEntries = (): ModuleEntriesState => ({
  reqModuleEntries: [],
  importEntries: [],
  exportEntries: [],
  starExportEntries: [],
})

/**
 * 添加模块依赖条目。
 *
 * @source QuickJS/src/core/parser.c:14060-14115
 * @see add_req_module_entry
 */
export const addReqModuleEntry = (
  state: ModuleEntriesState,
  moduleName: JSAtom,
  attributes: JSValue = null,
): number => {
  const entry: JSReqModuleEntry = {
    moduleName,
    module: null,
    attributes,
  }
  state.reqModuleEntries.push(entry)
  return state.reqModuleEntries.length - 1
}

/**
 * 添加 import 条目。
 *
 * @source QuickJS/src/core/parser.c:14060-14180
 * @see add_import_entry
 */
export const addImportEntry = (
  state: ModuleEntriesState,
  options: { varIdx: number; isStar: boolean; importName: JSAtom; reqModuleIdx: number },
): number => {
  const entry: JSImportEntry = {
    varIdx: options.varIdx,
    isStar: options.isStar,
    importName: options.importName,
    reqModuleIdx: options.reqModuleIdx,
  }
  state.importEntries.push(entry)
  return state.importEntries.length - 1
}

/**
 * 添加 export 条目。
 *
 * @source QuickJS/src/core/parser.c:14100-14180
 * @see add_export_entry2
 */
export const addExportEntry2 = (
  state: ModuleEntriesState,
  options: {
    exportType: JSExportTypeEnum
    localName: JSAtom
    exportName: JSAtom
    varIdx?: number
    reqModuleIdx?: number
  },
): number => {
  const entry: JSExportEntry = {
    exportType: options.exportType,
    localName: options.localName,
    exportName: options.exportName,
    u: options.exportType === JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL
      ? { local: { varIdx: options.varIdx ?? -1, varRef: null } }
      : { reqModuleIdx: options.reqModuleIdx ?? -1 },
  }
  state.exportEntries.push(entry)
  return state.exportEntries.length - 1
}

/**
 * 添加 export * 条目。
 *
 * @source QuickJS/src/core/parser.c:14180-14220
 * @see add_star_export_entry
 */
export const addStarExportEntry = (
  state: ModuleEntriesState,
  reqModuleIdx: number,
): number => {
  state.starExportEntries.push({ reqModuleIdx })
  return state.starExportEntries.length - 1
}
