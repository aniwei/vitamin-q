import type { JSAtom } from '../types/function-def'
import type { ModuleEntriesState } from './module-entries'
import { JSExportTypeEnum } from '../types/module'

/**
 * 模块变量处理（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:14220-14320
 * @see add_module_variables
 */
export const addModuleVariables = (entries: ModuleEntriesState): JSAtom[] => {
  const exports: JSAtom[] = []
  for (const entry of entries.exportEntries) {
    if (entry.exportType === JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL) {
      exports.push(entry.localName)
    }
  }
  return exports
}
