import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, relative, basename } from 'node:path'

interface Atom {
  id: number
  key: string
}

interface OpcodeMeta {
  name: string
  code: number
  nPop: number
  nPush: number
  fmt: number
  size: number
  isTemp: boolean
}

interface StringArray {
  size: () => number
  get: (index: number) => string
  push_back: (str: string) => void
}

interface BytecodeTag {
  id: number
  name: string
}

interface WasmInstance {
  runWithBinary: (input: Uint8Array, args: StringArray) => void
  dumpWithBinary: (input: Uint8Array, args: StringArray) => string
  compile: (source: string, sourcePath: string, args: StringArray) => Uint8Array
  compileScript: (source: string, sourcePath: string, args: StringArray) => Uint8Array
  getBytecodeVersion: () => number
  getFirstAtomId: () => number
  getAtoms: () => Atom[]
  getEnvironmentAtoms: () => Atom[]
  getOpcodes: () => OpcodeMeta[]
  getBytecodeTags: () => BytecodeTag[]
  getCompileFlags: () => number
  getCompileEnums: () => Record<string, number>
  getParseFunctionEnums: () => Array<{ id: number; name: string }>
  getParseExportEnums: () => Array<{ id: number; name: string }>
  getVarKindEnums: () => Array<{ id: number; name: string }>
  getBlockEnvLayout: () => Array<{ name: string; offset: number; size: number }>
  getFunctionBytecodeLayout: () => Array<{ name: string; offset: number; size: number }>
  getModuleDefLayout: () => Array<{ name: string; offset: number; size: number }>
  getFunctionDefLayout: () => Array<{ name: string; offset: number; size: number }>
  getVarDefLayout: () => Array<{ name: string; offset: number; size: number }>
  getVarScopeLayout: () => Array<{ name: string; offset: number; size: number }>
  getClosureVarLayout: () => Array<{ name: string; offset: number; size: number }>
  getGlobalVarLayout: () => Array<{ name: string; offset: number; size: number }>
  getImportEntryLayout: () => Array<{ name: string; offset: number; size: number }>
  getExportEntryLayout: () => Array<{ name: string; offset: number; size: number }>
  getStarExportEntryLayout: () => Array<{ name: string; offset: number; size: number }>
  getReqModuleEntryLayout: () => Array<{ name: string; offset: number; size: number }>
  getLineCol: (input: string, position: number) => { line: number; column: number }
  getLineColCached: (
    input: string,
    position: number,
    cachePtr: number,
    cacheLine: number,
    cacheColumn: number,
  ) => { ptr: number; line: number; column: number }
}

export class QuickJSLib {
  // 使用 any 以避免对 Emscripten 模块结构的过度约束
  static WasmInstance: any | null = null

  private static outputHandlers: {
    print: (text: string) => void
    printErr: (text: string) => void
  } = {
    print: (text: string) => console.log(text),
    printErr: (text: string) => console.error(text),
  }

  static setOutputHandlers(handlers: Partial<typeof QuickJSLib.outputHandlers>) {
    QuickJSLib.outputHandlers = {
      ...QuickJSLib.outputHandlers,
      ...handlers,
    }
  }

  static async withCapturedOutput<T>(fn: () => Promise<T> | T): Promise<{ result: T; stdout: string[]; stderr: string[] }> {
    const stdout: string[] = []
    const stderr: string[] = []

    const prev = QuickJSLib.outputHandlers
    QuickJSLib.setOutputHandlers({
      print: (text) => stdout.push(String(text ?? '')),
      printErr: (text) => stderr.push(String(text ?? '')),
    })

    try {
      const result = await fn()
      return { result, stdout, stderr }
    } finally {
      QuickJSLib.outputHandlers = prev
    }
  }

  static ensureWasmBuilt () {
    const path = resolve(process.cwd(), 'third_party/QuickJS/wasm/output/quickjs_wasm.js')
    const configPath = resolve(process.cwd(), 'third_party/QuickJS/wasm/output/quickjs_wasm.build-config.json')
    const wantTrace = process.env.QTS_TRACE_ENABLED === '1'
    const wantTraceOverride = Boolean(
      process.env.QTS_TRACE_LEVEL ||
      process.env.QTS_TRACE_EMIT ||
      process.env.QTS_TRACE_VARIABLE ||
      process.env.QTS_TRACE_CLOSURE ||
      process.env.QTS_TRACE_LABEL ||
      process.env.QTS_TRACE_STACK ||
      process.env.QTS_TRACE_PC2LINE ||
      process.env.QTS_TRACE_SCOPE ||
      process.env.QTS_TRACE_ASSIGN,
    )

    const desiredEnabled = (wantTrace || wantTraceOverride) ? 1 : 0
    const desiredLevel = (() => {
      const v = process.env.QTS_TRACE_LEVEL
      if (v === '1' || v === '2' || v === '3') return Number(v)
      return 1
    })()
    const desiredCategory = (envKey: string): 0 | 1 => {
      if (!desiredEnabled) return 0
      const v = process.env[envKey]
      if (v === '0') return 0
      if (v === '1') return 1
      return 1
    }
    const desired = {
      enabled: desiredEnabled,
      level: desiredLevel,
      categories: {
        EMIT: desiredCategory('QTS_TRACE_EMIT'),
        VARIABLE: desiredCategory('QTS_TRACE_VARIABLE'),
        CLOSURE: desiredCategory('QTS_TRACE_CLOSURE'),
        LABEL: desiredCategory('QTS_TRACE_LABEL'),
        STACK: desiredCategory('QTS_TRACE_STACK'),
        PC2LINE: desiredCategory('QTS_TRACE_PC2LINE'),
        SCOPE: desiredCategory('QTS_TRACE_SCOPE'),
        ASSIGN: desiredCategory('QTS_TRACE_ASSIGN'),
      },
    }

    if (existsSync(path) && existsSync(configPath)) {
      try {
        const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
        const built = cfg?.qtsTrace
        const same =
          built?.enabled === desired.enabled &&
          built?.level === desired.level &&
          built?.categories?.EMIT === desired.categories.EMIT &&
          built?.categories?.VARIABLE === desired.categories.VARIABLE &&
          built?.categories?.CLOSURE === desired.categories.CLOSURE &&
          built?.categories?.LABEL === desired.categories.LABEL &&
          built?.categories?.STACK === desired.categories.STACK &&
          built?.categories?.PC2LINE === desired.categories.PC2LINE &&
          built?.categories?.SCOPE === desired.categories.SCOPE &&
          built?.categories?.ASSIGN === desired.categories.ASSIGN
        if (same) return path
      } catch {
        // 继续走后续逻辑：触发重建
      }
    }

    if (existsSync(path) && desiredEnabled === 0 && !existsSync(configPath)) {
      // 旧版构建没有 marker：默认认为是 non-trace
      return path
    }

    const buildScript = resolve(process.cwd(), 'scripts/buildWasm.ts')

    const args: string[] = ['tsx', buildScript]
    if (wantTrace || wantTraceOverride) {
      args.push('--trace')
      const lvl = process.env.QTS_TRACE_LEVEL
      if (lvl === '1' || lvl === '2' || lvl === '3') {
        args.push('--trace-level', lvl)
      }
    }

    const r = spawnSync('npx', args, { stdio: 'inherit', encoding: 'utf8' })
    
    if (r.status !== 0) return null
    return existsSync(path) ? path : null
  }

  static getWasmInstance = async (): Promise<any> => {
    if (QuickJSLib.WasmInstance) return QuickJSLib.WasmInstance

    const path = QuickJSLib.ensureWasmBuilt()
    if (!path) throw new Error('QuickJS wasm binding not available')

    const WasmModule: any = await import(path)
    QuickJSLib.WasmInstance = await WasmModule.default({
      print: (text: string) => QuickJSLib.outputHandlers.print(text),
      printErr: (text: string) => QuickJSLib.outputHandlers.printErr(text),
    })
    return QuickJSLib.WasmInstance as WasmInstance
  }

  static async getQuickJSModule(): Promise<any> {
    return this.getWasmInstance()
  }

  static getCompileFlags = async (): Promise<number> => {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    return WasmInstance.QuickJSBinding.getCompileOptions()
  }

  static getCompileFlagEnums = async (): Promise<Record<string, number>> => {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const enums: Record<string, number> = {}

    enums['COMPILE_FLAG_NONE'] = WasmInstance.CompileFlags.COMPILE_FLAG_NONE.value
    enums['COMPILE_FLAG_DUMP'] = WasmInstance.CompileFlags.COMPILE_FLAG_DUMP.value
    enums['COMPILE_FLAG_BIGNUM'] = WasmInstance.CompileFlags.COMPILE_FLAG_BIGNUM.value
    enums['COMPILE_FLAG_SHORT_OPCODES'] = WasmInstance.CompileFlags.COMPILE_FLAG_SHORT_OPCODES.value

    return enums
  }

  static getLineCol = async (input: string, position: number): Promise<{ line: number; column: number }> => {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const result = WasmInstance.QuickJSBinding.getLineCol(input, position)
    return { line: result.line, column: result.column }
  }

  static getLineColCached = async (
    input: string,
    position: number,
    cache: { ptr: number; line: number; column: number },
  ): Promise<{ ptr: number; line: number; column: number }> => {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const result = WasmInstance.QuickJSBinding.getLineColCached(
      input,
      position,
      cache.ptr,
      cache.line,
      cache.column,
    )
    return { ptr: result.ptr, line: result.line, column: result.column }
  }

  static async runWithBinaryPath(binaryPath: string) {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const source = readFileSync(binaryPath)

    const input = new WasmInstance.Uint8Array()
    for (let i = 0; i < source.length; i++) {
      input.push_back(source[i])
    }

    WasmInstance.QuickJSBinding.runWithBinary(input, new WasmInstance.StringArray())
  }

  static async dumpWithBinaryPath(binaryPath: string) {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const source = readFileSync(binaryPath)

    const input = new WasmInstance.Uint8Array()
    for (let i = 0; i < source.length; i++) {
      input.push_back(source[i])
    }

    const text = WasmInstance.QuickJSBinding.dumpWithBinary(input, new WasmInstance.StringArray())
    console.log(String(text || ''))
  }

  static async dumpBytesToString(bytes: Uint8Array | Buffer): Promise<string> {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const input = new WasmInstance.Uint8Array()
    for (let i = 0; i < bytes.length; i++) input.push_back(bytes[i])
    const text = WasmInstance.QuickJSBinding.dumpWithBinary(input, new WasmInstance.StringArray())
    return String(text || '')
  }

  static async getCompileEnums(): Promise<Record<string, number>> {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const enums: Record<string, number> = {}

    enums['COMPILE_FLAG_NONE'] = WasmInstance.CompileFlags.COMPILE_FLAG_NONE.value
    enums['COMPILE_FLAG_DUMP'] = WasmInstance.CompileFlags.COMPILE_FLAG_DUMP.value
    enums['COMPILE_FLAG_BIGNUM'] = WasmInstance.CompileFlags.COMPILE_FLAG_BIGNUM.value
    enums['COMPILE_FLAG_SHORT_OPCODES'] = WasmInstance.CompileFlags.COMPILE_FLAG_SHORT_OPCODES.value

    return enums
  }

  static async getPutLValueEnum(): Promise<Record<string, number>> {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const enums: Record<string, number> = {}

    enums['PUT_LVALUE_NOKEEP'] = WasmInstance.PutLValueEnum.PUT_LVALUE_NOKEEP.value
    enums['PUT_LVALUE_NOKEEP_DEPTH'] = WasmInstance.PutLValueEnum.PUT_LVALUE_NOKEEP_DEPTH.value
    enums['PUT_LVALUE_KEEP_TOP'] = WasmInstance.PutLValueEnum.PUT_LVALUE_KEEP_TOP.value
    enums['PUT_LVALUE_KEEP_SECOND'] = WasmInstance.PutLValueEnum.PUT_LVALUE_KEEP_SECOND.value
    enums['PUT_LVALUE_NOKEEP_BOTTOM'] = WasmInstance.PutLValueEnum.PUT_LVALUE_NOKEEP_BOTTOM.value

    return enums
  }

  static async getOpcodes() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getOpcodes()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const o = vec.get(i)
      map[o.name] = o.id
    }
    return map
  }

  static async getPC2LineCodes() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getPC2LineCodes()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const o = vec.get(i)
      map[o.name] = o.id
    }
    return map
  }

  static async getSpecialObjects() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getSpecialObjects()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const o = vec.get(i)
      map[o.name] = o.id
    }
    return map
  }

  static async getJSModes() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getJSModes()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const m = vec.get(i)
      map[m.name] = m.id
    }
    return map
  }

  static async getFunctionKinds() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getFunctionKinds()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const t = vec.get(i)
      map[t.name] = t.id
    }
    return map
  }

  static async getBytecodeTags() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getBytecodeTags()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const t = vec.get(i)
      map[t.name] = t.id
    }
    return map
  }

  static async getBytecodeVersion() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    return WasmInstance.QuickJSBinding.getBytecodeVersion()
  }

  static async getFirstAtomId(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getFirstAtomId();
  }

  static async getGlobalVarOffset(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getGlobalVarOffset();
  }

  static async getArgumentVarOffset(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getArgumentVarOffset();
  }

  static async getArgScopeIndex(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getArgScopeIndex();
  }

  static async getArgScopeEnd(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getArgScopeEnd();
  }

  static async getDebugScopeIndex(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getDebugScopeIndex();
  }

  static async getMaxLocalVars(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getMaxLocalVars();
  }

  static async getStackSizeMax(): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getStackSizeMax();
  }

  static async getOpcodeName(opcode: number): Promise<string> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getOpcodeName(opcode);
  }

  static async getOpcodeId(name: string): Promise<number> {
    const WasmInstance = await this.getWasmInstance();
    return WasmInstance.QuickJSBinding.getOpcodeId(name);
  }

  static async getAllAtoms() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getAtoms()
    const atoms: Atom[] = []
    for (let i = 0; i < vec.size(); i++) {
      const a = vec.get(i)
      atoms.push({ id: a.id, key: a.name })
    }
    return atoms
  }

  static async getEnvironmentAtoms() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getEnvironmentAtoms()
    const atoms: Atom[] = []
    for (let i = 0; i < vec.size(); i++) {
      const a = vec.get(i)
      atoms.push({ id: a.id, key: a.name })
    }
    return atoms
  }

  static async getAllBytecodeTags() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getBytecodeTags()
    const tags: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const t = vec.get(i)
      tags[t.name] = t.id
    }
    return tags
  }

  static async getParseFunctionEnums() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getParseFunctionEnums()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      map[item.name] = item.id
    }
    return map
  }

  static async getParseExportEnums() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getParseExportEnums()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      map[item.name] = item.id
    }
    return map
  }

  static async getVarKindEnums() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getVarKindEnums()
    const map: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      map[item.name] = item.id
    }
    return map
  }

  static async getBlockEnvLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getBlockEnvLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getFunctionBytecodeLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getFunctionBytecodeLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getModuleDefLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getModuleDefLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getFunctionDefLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getFunctionDefLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getVarDefLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getVarDefLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getVarScopeLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getVarScopeLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getClosureVarLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getClosureVarLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getGlobalVarLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getGlobalVarLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getImportEntryLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getImportEntryLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getExportEntryLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getExportEntryLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getStarExportEntryLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getStarExportEntryLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getReqModuleEntryLayout() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getReqModuleEntryLayout()
    const list: Array<{ name: string; offset: number; size: number }> = []
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i)
      list.push({ name: item.name, offset: item.offset, size: item.size })
    }
    return list
  }

  static async getAllOpcodeFormats() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getOpcodeFormats()
    const formats: Record<string, number> = {}
    for (let i = 0; i < vec.size(); i++) {
      const f = vec.get(i)
      formats[f.name] = f.id
    }
    return formats
  }

  static async getAllOpcodes() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const vec = WasmInstance.QuickJSBinding.getOpcodes()
    const out: OpcodeMeta[] = []
    for (let i = 0; i < vec.size(); i++) {
      const o = vec.get(i)
      out.push({ name: o.name, code: o.id, nPop: o.nPop, nPush: o.nPush, fmt: o.fmt, size: o.size, isTemp: o.isTemp })
    }
    return out
  }

  static async getOpcodeOverrideMap(): Promise<Map<string, number>> {
    const list = await QuickJSLib.getAllOpcodes()
    return new Map(list.map(o => [o.name, o.code]))
  }

  static async getCompileOptions() {
    const WasmInstance = await QuickJSLib.getWasmInstance()
    const options = WasmInstance.QuickJSBinding.getCompileOptions()
    return options
  }

  static async compileSource(source: string, sourcePath: string = '<eval>', cwd?: string): Promise<Buffer> {
    const WasmInstance = await QuickJSLib.getWasmInstance()


    // QuickJS WASM binding can accept Uint8Array input. Using bytes avoids
    // hitting V8 \"Invalid string length\" on very large sources (e.g. Octane bundles).
    const sourceBytes = new TextEncoder().encode(source)
    const result = await WasmInstance.QuickJSBinding.compile(
      sourceBytes as any, 
      relative(cwd || process.cwd(), sourcePath), 
      new WasmInstance.StringArray())

    const output: Buffer = Buffer.alloc(result.size())
    for (let i = 0; i < result.size(); i++) {
      output[i] = result.get(i)
    }
    
    return output
  }

  /**
   * Compile source as script (global eval mode) instead of module
   */
  static async compileSourceAsScript(source: string, sourcePath: string = '<eval>', cwd?: string): Promise<Buffer> {
    const WasmInstance = await QuickJSLib.getWasmInstance()


    // QuickJS WASM binding can accept Uint8Array input. Using bytes avoids
    // hitting V8 \"Invalid string length\" on very large sources (e.g. Octane bundles).
    const sourceBytes = new TextEncoder().encode(source)
    const result = await WasmInstance.QuickJSBinding.compileScript(
      sourceBytes as any, 
      relative(cwd || process.cwd(), sourcePath), 
      new WasmInstance.StringArray())

    const output: Buffer = Buffer.alloc(result.size())
    for (let i = 0; i < result.size(); i++) {
      output[i] = result.get(i)
    }
    
    return output
  }

  static async compileSourceWithPath(sourcePath: string, cwd?: string): Promise<Buffer> {
    const source = readFileSync(sourcePath, 'utf-8')
    return this.compileSource(source, sourcePath, cwd)
  }
}