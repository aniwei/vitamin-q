import ts from 'typescript'

import type { AtomTable } from '../atom/atom-table'
import type { JSAtom } from '../types/function-def'
import { JSExportTypeEnum } from '../types/module'
import { addExportEntry2, addImportEntry, addReqModuleEntry, addStarExportEntry, createModuleEntries } from './module-entries'

export interface ModuleParseResult {
  entries: ReturnType<typeof createModuleEntries>
  moduleName: JSAtom
}

/**
 * 模块解析（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:14660-14980
 * @see js_parse_import
 * @see js_parse_export
 */
export const parseModule = (sourceFile: ts.SourceFile, atomTable: AtomTable): ModuleParseResult => {
  const moduleName = atomTable.getOrAdd(sourceFile.fileName)
  const entries = createModuleEntries()

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const moduleText = statement.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '')
      const moduleAtom = atomTable.getOrAdd(moduleText)
      const reqIdx = addReqModuleEntry(entries, moduleAtom, null)

      const clause = statement.importClause
      if (!clause) continue

      if (clause.name) {
        const importAtom = atomTable.getOrAdd(clause.name.text)
        addImportEntry(entries, { varIdx: 0, isStar: false, importName: importAtom, reqModuleIdx: reqIdx })
      }

      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          const importAtom = atomTable.getOrAdd('*')
          addImportEntry(entries, { varIdx: 0, isStar: true, importName: importAtom, reqModuleIdx: reqIdx })
        } else if (ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            const importAtom = atomTable.getOrAdd(element.propertyName?.text ?? element.name.text)
            addImportEntry(entries, { varIdx: 0, isStar: false, importName: importAtom, reqModuleIdx: reqIdx })
          }
        }
      }
    }

    if (ts.isExportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier
      if (moduleSpecifier) {
        const moduleText = moduleSpecifier.getText(sourceFile).replace(/['"]/g, '')
        const moduleAtom = atomTable.getOrAdd(moduleText)
        const reqIdx = addReqModuleEntry(entries, moduleAtom, null)

        if (!statement.exportClause) {
          addStarExportEntry(entries, reqIdx)
          continue
        }

        if (ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            const exportName = atomTable.getOrAdd(element.name.text)
            addExportEntry2(entries, {
              exportType: JSExportTypeEnum.JS_EXPORT_TYPE_INDIRECT,
              localName: exportName,
              exportName,
              reqModuleIdx: reqIdx,
            })
          }
        }
        continue
      }

      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const localName = atomTable.getOrAdd(element.propertyName?.text ?? element.name.text)
          const exportName = atomTable.getOrAdd(element.name.text)
          addExportEntry2(entries, {
            exportType: JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL,
            localName,
            exportName,
            varIdx: 0,
          })
        }
      }
    }

    if (ts.isExportAssignment(statement)) {
      const exportName = atomTable.getOrAdd('default')
      addExportEntry2(entries, {
        exportType: JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL,
        localName: exportName,
        exportName,
        varIdx: 0,
      })
    }

    const hasExport = statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)
    if (hasExport && ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        const localName = atomTable.getOrAdd(decl.name.text)
        const exportName = atomTable.getOrAdd(decl.name.text)
        addExportEntry2(entries, {
          exportType: JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL,
          localName,
          exportName,
          varIdx: 0,
        })
      }
    }

    if (hasExport && ts.isFunctionDeclaration(statement) && statement.name) {
      const localName = atomTable.getOrAdd(statement.name.text)
      const exportName = atomTable.getOrAdd(statement.name.text)
      addExportEntry2(entries, {
        exportType: JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL,
        localName,
        exportName,
        varIdx: 0,
      })
    }

    if (hasExport && ts.isClassDeclaration(statement) && statement.name) {
      const localName = atomTable.getOrAdd(statement.name.text)
      const exportName = atomTable.getOrAdd(statement.name.text)
      addExportEntry2(entries, {
        exportType: JSExportTypeEnum.JS_EXPORT_TYPE_LOCAL,
        localName,
        exportName,
        varIdx: 0,
      })
    }
  }

  return { entries, moduleName }
}
