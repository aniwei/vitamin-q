import type { JSImportEntry, JSExportEntry, JSReqModuleEntry, JSStarExportEntry } from '../types/module'
import { JSExportTypeEnum } from '../types/module'
import { bcGetLeb128, bcGetU32, bcGetU8 } from './bytecode-reader'
import { JS_ReadObjectRec } from './value-reader'
import type { JSAtom } from '../types/function-def'

export interface ModuleReadView {
  moduleName: JSAtom
  reqModuleEntries: JSReqModuleEntry[]
  exportEntries: JSExportEntry[]
  starExportEntries: JSStarExportEntry[]
  importEntries: JSImportEntry[]
}

/**
 * 模块反序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:1040-1160
 */
export const JS_ReadModule = (
  reader: { buf: Uint8Array; offset: number },
  idxToAtom: JSAtom[],
): ModuleReadView => {
  const moduleNameIdx = bcGetU32(reader)

  const reqModuleCount = bcGetLeb128(reader)
  const reqModuleEntries: JSReqModuleEntry[] = []
  for (let i = 0; i < reqModuleCount; i += 1) {
    const moduleIdx = bcGetU32(reader)
    const attributes = JS_ReadObjectRec(reader)
    reqModuleEntries.push({ moduleName: idxToAtom[moduleIdx] ?? 0, module: null, attributes })
  }

  const exportCount = bcGetLeb128(reader)
  const exportEntries: JSExportEntry[] = []
  for (let i = 0; i < exportCount; i += 1) {
    const exportType = bcGetLeb128(reader)
    const localNameIdx = bcGetU32(reader)
    const exportNameIdx = bcGetU32(reader)
    const extra = bcGetLeb128(reader)
    exportEntries.push({
      exportType: exportType as JSExportTypeEnum,
      localName: idxToAtom[localNameIdx] ?? 0,
      exportName: idxToAtom[exportNameIdx] ?? 0,
      u: exportType === 0 ? { local: { varIdx: extra, varRef: null } } : { reqModuleIdx: extra },
    })
  }

  const starCount = bcGetLeb128(reader)
  const starExportEntries: JSStarExportEntry[] = []
  for (let i = 0; i < starCount; i += 1) {
    starExportEntries.push({ reqModuleIdx: bcGetLeb128(reader) })
  }

  const importCount = bcGetLeb128(reader)
  const importEntries: JSImportEntry[] = []
  for (let i = 0; i < importCount; i += 1) {
    const varIdx = bcGetLeb128(reader)
    const isStar = bcGetU8(reader) === 1
    const importNameIdx = bcGetU32(reader)
    const reqModuleIdx = bcGetLeb128(reader)
    importEntries.push({
      varIdx,
      isStar,
      importName: idxToAtom[importNameIdx] ?? 0,
      reqModuleIdx,
    })
  }

  return {
    moduleName: idxToAtom[moduleNameIdx] ?? 0,
    reqModuleEntries,
    exportEntries,
    starExportEntries,
    importEntries,
  }
}
