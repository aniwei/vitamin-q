import type { JSImportEntry, JSExportEntry, JSReqModuleEntry, JSStarExportEntry } from '../types/module'
import type { JSAtom } from '../types/function-def'
import { bcPutLeb128, bcPutU8 } from './bytecode-writer'
import { bcPutAtom, type AtomWriteState } from './atom-writer'
import { JS_WriteObjectRec } from './value-writer'

export interface ModuleWriteView {
  moduleName: JSAtom
  reqModuleEntries: JSReqModuleEntry[]
  exportEntries: JSExportEntry[]
  starExportEntries: JSStarExportEntry[]
  importEntries: JSImportEntry[]
}

/**
 * 模块序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:900-1040
 */
export const JS_WriteModule = (
  writer: { buf: number[] },
  atomState: AtomWriteState,
  module: ModuleWriteView,
) => {
  bcPutAtom(atomState, writer, module.moduleName)

  bcPutLeb128(writer, module.reqModuleEntries.length)
  for (const entry of module.reqModuleEntries) {
    bcPutAtom(atomState, writer, entry.moduleName)
    JS_WriteObjectRec(writer, entry.attributes)
  }

  bcPutLeb128(writer, module.exportEntries.length)
  for (const entry of module.exportEntries) {
    bcPutLeb128(writer, entry.exportType)
    bcPutAtom(atomState, writer, entry.localName)
    bcPutAtom(atomState, writer, entry.exportName)
    if ('local' in entry.u) {
      bcPutLeb128(writer, entry.u.local.varIdx)
    } else {
      bcPutLeb128(writer, entry.u.reqModuleIdx)
    }
  }

  bcPutLeb128(writer, module.starExportEntries.length)
  for (const entry of module.starExportEntries) {
    bcPutLeb128(writer, entry.reqModuleIdx)
  }

  bcPutLeb128(writer, module.importEntries.length)
  for (const entry of module.importEntries) {
    bcPutLeb128(writer, entry.varIdx)
    bcPutU8(writer, entry.isStar ? 1 : 0)
    bcPutAtom(atomState, writer, entry.importName)
    bcPutLeb128(writer, entry.reqModuleIdx)
  }
}
