# Design: TypeScript QuickJS 字节码编译器

## Context

### 背景

Vitamin-Q 项目已完成对 QuickJS 字节码内部机制的全面文档化。现需基于 `docs/quickjs/` 的文档，用 TypeScript 实现一个完整的字节码编译器。

### 约束

- **目标兼容性**: 生成的字节码必须与 QuickJS 2025-04-26 版本兼容
- **语言支持**: ES2020 完整支持（通过 TypeScript 编译到 ES2020）
- **运行环境**: Node.js 20+
- **使用 TypeScript Compiler API**: 采用成熟的 TypeScript 编译器进行语法解析，专注于字节码生成

### 利益相关者

- **开发者**: 需要清晰的模块边界和类型定义
- **测试者**: 需要可验证的编译输出
- **用户**: 需要可靠的编译结果

## Goals / Non-Goals

### Goals
1. 使用 TypeScript Compiler API 解析源码，实现 TypeScript/JavaScript 到 QuickJS 字节码编译流程
2. 模块化设计，便于理解和扩展
3. 与 QuickJS 原生编译输出保持兼容
4. 利用 TypeScript 的类型系统和错误报告能力
5. **参照 QuickJS C 源码流程实现，并在代码中标注对应的 C 源码位置**
6. **类结构完全参照 QuickJS 字段，使用驼峰风格命名**
7. **使用环境变量模拟 C 宏条件编译**

### Non-Goals
1. 不自行实现词法分析器或语法分析器
2. 不实现运行时（仅生成字节码）
3. 首次版本编译目标为 ES2020（后续可扩展）
4. 不进行激进的性能优化（首先保证正确性）

## Decisions

### Decision 1: 两阶段编译架构（采用 TypeScript AST）

**选择**: 使用 TypeScript Compiler API 解析，简化为两阶段编译模型

```
Source → [TypeScript Parser] → ts.AST → [Phase 1: Emit] → [Phase 2: resolve_variables] → [Phase 3: resolve_labels] → Bytecode
```

**理由**:
- TypeScript Compiler API 是成熟、稳定的解析器
- 自动支持最新的 JavaScript/TypeScript 语法
- 减少大量词法/语法分析实现工作
- 可直接处理 TypeScript 源码（在编译前降级到 ES2020）

**替代方案**:
- 自定义词法/语法分析器：工作量大，容易出错
- Babel：额外依赖，与项目技术栈不一致

### Decision 2: 模块结构

**选择**: 按编译阶段和职责划分模块，定义清晰的功能边界

```
src/
├── types/                 # 类型定义
│   ├── opcodes.ts        # 254 个操作码枚举
│   ├── bytecode.ts       # 字节码相关类型
│   └── function-def.ts   # JSFunctionDef 等数据结构
├── config/                # 配置
│   └── env.ts            # 环境变量模拟 C 宏
├── ast/                   # 语句调度模块 (AST Visitor)
│   ├── visitor.ts        # AST 遍历器，调度各类节点处理
│   ├── dispatcher.ts     # 语句调度器，根据节点类型分发
│   ├── utils.ts          # AST 工具函数
│   └── source-location.ts # 源码位置转换
├── emitter/               # 字节码发射模块 (Phase 1)
│   ├── emitter.ts        # 主发射器（emit_op, emit_u8 等）
│   ├── expressions.ts    # 表达式发射
│   ├── statements.ts     # 语句发射
│   ├── functions.ts      # 函数发射
│   ├── classes.ts        # 类发射
│   ├── bytecode-buffer.ts # 字节码缓冲区
│   └── constant-pool.ts  # 常量池管理
├── variable/              # 变量模块 (Phase 2)
│   ├── scope-manager.ts  # 作用域管理（push_scope, pop_scope）
│   ├── variable-resolver.ts # resolve_variables 实现
│   └── closure-analyzer.ts # 闭包变量分析 (add_closure_var)
├── label/                 # 标签模块 (Phase 3)
│   ├── label-manager.ts  # 标签管理（new_label, emit_label, emit_goto）
│   └── label-resolver.ts # resolve_labels 实现，跳转偏移计算
├── optimizer/             # 字节码优化模块
│   ├── peephole.ts       # 窥孔优化
│   ├── short-opcodes.ts  # 短操作码转换（get_loc → get_loc0-3）
│   └── dead-code.ts      # 死代码消除
├── debug/                 # 调试信息模块
│   ├── pc2line.ts        # PC 到行号映射（debug_pc2line）
│   ├── source-map.ts     # 源码映射生成
│   └── debug-info.ts     # 调试信息汇总
├── serializer/            # 序列化模块
│   ├── bytecode-writer.ts # 字节码序列化输出
│   ├── function-writer.ts # 函数字节码序列化
│   └── module-writer.ts  # 模块字节码序列化
├── runtime/               # 运行时集成
│   ├── runner.ts         # 字节码运行器
│   ├── comparator.ts     # 字节码对比验证
│   └── execution-validator.ts # 执行结果验证
└── compiler.ts            # 编译器入口
```

**模块职责说明**:

| 模块 | 职责 | C 源码对应 |
|------|------|------------|
| ast/ | 语句调度，AST 节点遍历和分发 | js_parse_* 函数系列 |
| emitter/ | 字节码发射，生成初始字节码 | emit_op, emit_u8 等 |
| variable/ | 变量解析，作用域管理 | resolve_variables |
| label/ | 标签管理，跳转偏移计算 | resolve_labels |
| optimizer/ | 字节码优化 | 窥孔优化部分 |
| debug/ | 调试信息生成 | pc2line 等 |
| serializer/ | 字节码序列化输出 | js_write_* 函数系列 |

**理由**:
- 无需实现词法/语法分析，直接使用 TypeScript AST
- 清晰的职责边界
- 便于单元测试
- 与文档结构对应

**C 源码对照标注规范**:

每个模块和函数应标注对应的 QuickJS C 源码位置：

```typescript
/**
 * 发射二元运算表达式字节码
 * 
 * @source quickjs.c:23456-23489
 * @see js_parse_binary_op
 */
function emitBinaryExpression(node: ts.BinaryExpression): void {
  // 实现代码...
}

/**
 * 变量解析 - 将 scope_get_var 转换为 get_loc/get_arg/get_var_ref
 * 
 * @source quickjs.c:28901-29156
 * @see resolve_variables
 */
function resolveVariables(fd: JSFunctionDef): void {
  // 实现代码...
}
```

标注格式：
- `@source quickjs.c:LINE` - 单行引用
- `@source quickjs.c:START-END` - 行范围引用
- `@see FUNCTION_NAME` - 对应的 C 函数名

### Decision 3: 操作码表示

**选择**: 使用 TypeScript const enum 定义操作码，**通过 QuickJS WASM 自动生成**

**生成机制**:
```typescript
// scripts/getEnv.ts - 从 QuickJS WASM 导出枚举和常量
import { QuickJSWasm } from './QuickJSLib';

async function generateOpcodes(): Promise<void> {
  const qjs = await QuickJSWasm.create();
  
  // 从 QuickJS WASM 获取操作码定义
  const opcodes = qjs.getOpcodeDefinitions();
  
  // 生成 TypeScript 枚举文件
  const enumContent = generateEnumFile(opcodes);
  await writeFile('src/types/opcodes.generated.ts', enumContent);
}
```

**生成的文件** (`src/types/opcodes.generated.ts`):
```typescript
/**
 * 操作码枚举 - 自动从 QuickJS WASM 生成
 * 
 * @generated 由 scripts/getEnv.ts 生成，请勿手动修改
 * @source QuickJS WASM 运行时
 */
export const enum Opcode {
  // 值压栈
  OP_invalid = 0,
  OP_push_i32 = 1,
  OP_push_const = 2,
  // ...
  
  // 临时操作码 (仅编译阶段)
  OP_enter_scope = 200,
  OP_scope_get_var = 201,
  // ...
}

export const OpcodeInfo: Record<Opcode, {
  size: number;
  nPop: number;
  nPush: number;
  format: OpcodeFormat;
}> = {
  [Opcode.OP_push_i32]: { size: 5, nPop: 0, nPush: 1, format: 'i32' },
  // ...
};
```

**理由**:
- **确保完全对齐**: 枚举值直接从 QuickJS WASM 运行时获取，避免手动维护不一致
- const enum 在编译时内联，无运行时开销
- 自动化更新：QuickJS 版本升级时重新运行脚本即可
- 与 `docs/quickjs/opcode-reference.md` 对应
- 类型安全

### Decision 4: 直接使用 TypeScript AST

**选择**: 直接使用 `ts.Node` 类型体系，无需定义自定义 AST

```typescript
import * as ts from 'typescript';

// 直接处理 TypeScript AST 节点
function emitExpression(node: ts.Expression, ctx: EmitContext): void {
  if (ts.isBinaryExpression(node)) {
    emitExpression(node.left, ctx);
    emitExpression(node.right, ctx);
    emitBinaryOperator(node.operatorToken.kind, ctx);
  } else if (ts.isNumericLiteral(node)) {
    ctx.emitPushNumber(Number(node.text));
  }
  // ...
}
```

**理由**:
- TypeScript AST 已足够完整和详细
- 无需额外的 AST 转换层
- 丰富的类型守卫（`ts.isXxx`）简化处理
- 自动支持 TypeScript 特有语法（如类型注解会被忽略）

**替代方案**:
- 转换为 ESTree：增加不必要的转换开销
- 自定义 AST：工作量大且容易遗漏节点类型

### Decision 5: JSFunctionDef 实现

**选择**: 忠实移植 QuickJS 的 JSFunctionDef 结构，使用驼峰风格命名

**命名转换规则**:
- C 下划线命名 → TypeScript 驼峰命名
- `var_count` → `varCount`
- `arg_count` → `argCount`
- `byte_code` → `byteCode`
- `scope_level` → `scopeLevel`
- `is_eval` → `isEval`

```typescript
/**
 * 函数定义结构 - 完全对应 QuickJS C 结构体
 * 
 * @source quickjs.c - struct JSFunctionDef
 */
interface JSFunctionDef {
  // 基本信息
  funcName: Atom;           // C: func_name
  argCount: number;         // C: arg_count
  varCount: number;         // C: var_count
  definedArgCount: number;  // C: defined_arg_count
  
  // 字节码
  byteCode: BytecodeBuffer;
  
  // 常量池
  cpool: JSValue[];
  
  // 作用域
  scopes: Scope[];
  scopeLevel: number;
  scopeFirst: number;
  
  // 变量
  vars: JSVarDef[];
  args: JSVarDef[];
  closureVars: ClosureVar[];
  
  // 标签
  labels: LabelSlot[];
  
  // 子函数
  childList: JSFunctionDef[];
  
  // 标志位
  isEval: boolean;
  isGlobal: boolean;
  isArrow: boolean;
  isAsync: boolean;
  isGenerator: boolean;
  // ...
}
```

**理由**:
- 与 QuickJS 实现一致
- 便于对照文档调试
- 支持完整功能
- 驼峰命名符合 TypeScript 规范

### Decision 6: 宏环境模拟

**选择**: 使用 `process.env` 环境变量模拟 C 语言的条件编译宏

**环境变量定义** (`src/config/env.ts`):
```typescript
/**
 * 环境变量配置 - 模拟 C 语言条件编译宏
 * 
 * @source quickjs.c - #ifdef DEBUG / DUMP_BYTECODE 等
 */
export const Config = {
  /** 启用调试模式 - 对应 C: #ifdef DEBUG */
  DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  
  /** 输出字节码 - 对应 C: #ifdef DUMP_BYTECODE */
  DUMP_BYTECODE: process.env.DUMP_BYTECODE === 'true' || process.env.DUMP_BYTECODE === '1',
  
  /** 输出原子表 - 对应 C: #ifdef DUMP_ATOMS */
  DUMP_ATOMS: process.env.DUMP_ATOMS === 'true' || process.env.DUMP_ATOMS === '1',
  
  /** 输出读取操作 - 对应 C: #ifdef DUMP_READ_OBJECT */
  DUMP_READ_OBJECT: process.env.DUMP_READ_OBJECT === 'true' || process.env.DUMP_READ_OBJECT === '1',
  
  /** 输出内存使用 - 对应 C: #ifdef DUMP_MEM */
  DUMP_MEM: process.env.DUMP_MEM === 'true' || process.env.DUMP_MEM === '1',
  
  /** 输出闭包变量 - 对应 C: #ifdef DUMP_CLOSURE */
  DUMP_CLOSURE: process.env.DUMP_CLOSURE === 'true' || process.env.DUMP_CLOSURE === '1',
  
  /** 输出源码位置 - 对应 C: #ifdef DUMP_SOURCE */
  DUMP_SOURCE: process.env.DUMP_SOURCE === 'true' || process.env.DUMP_SOURCE === '1',
} as const;
```

**使用示例**:
```typescript
import { Config } from './config/env';

function emitBytecode(fd: JSFunctionDef): void {
  // 模拟 C 中的 #ifdef DUMP_BYTECODE
  if (Config.DUMP_BYTECODE) {
    console.log(`[DUMP] Bytecode for function: ${fd.funcName}`);
    dumpBytecode(fd.byteCode);
  }
  
  // 模拟 C 中的 #ifdef DEBUG
  if (Config.DEBUG) {
    validateBytecodeIntegrity(fd);
  }
}
```

**理由**:
- 与 QuickJS C 源码的调试机制保持一致
- 运行时可通过环境变量控制，无需重新编译
- 便于调试和问题排查
- 生产环境可完全禁用调试输出

### Decision 7: 错误处理策略

**选择**: 使用 Result 类型 + 错误收集器

```typescript
type CompileResult<T> = 
  | { success: true; value: T }
  | { success: false; errors: CompileError[] };

interface CompileError {
  code: string;
  message: string;
  loc: SourceLocation;
  severity: 'error' | 'warning';
}
```

**理由**:
- 可收集多个错误后一次报告
- 类型安全的错误处理
- 支持错误恢复继续解析

### Decision 8: 测试策略

**选择**: 三层测试 + 字节码完全对齐验证

1. **单元测试**: 各模块独立测试
   - AST 遍历器：节点类型检测验证
   - 发射器：操作码序列验证

2. **集成测试**: 使用 fixtures 目录
   - 编译 `fixtures/es2020/` 中的文件
   - 验证编译成功/失败

3. **字节码对齐测试**: 与 QuickJS WASM 完全对比
   - 使用 `scripts/QuickJSLib.ts` 调用 QuickJS WASM
   - **按字节对比**两者生成的字节码
   - 必须完全一致才视为通过

**理由**:
- QuickJS WASM 作为权威基准，确保 TypeScript 编译器逻辑正确
- 按字节对比可发现任何细微差异
- 每次迭代都能验证没有引入回归

### Decision 8: QuickJS WASM 作为验证基准

**选择**: QuickJS WASM 编译器作为 TypeScript 编译器的正确性验证基准

**验证流程**:
```
                    ┌──────────────────┐
Source Code ──────► │ TypeScript       │ ──► bytecode_ts
                    │ Compiler         │
                    └──────────────────┘
                              │
                              │  compare (byte-by-byte)
                              ▼
                    ┌──────────────────┐
Source Code ──────► │ QuickJS WASM     │ ──► bytecode_qjs
                    │ Compiler         │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ bytecode_ts ===  │ ──► PASS / FAIL
                    │ bytecode_qjs ?   │
                    └──────────────────┘
```

**验证时机**:
- 每次 TypeScript 编译器代码修改后
- CI/CD 流水线中自动运行
- 新增 fixture 测试用例时

**差异处理**:
```typescript
interface BytecodeCompareResult {
  match: boolean;
  fixture: string;
  tsBytecode: Uint8Array;
  qjsBytecode: Uint8Array;
  diffPositions?: number[];  // 不匹配的字节位置
  diffReport?: string;       // 可读的差异报告
}
```

**理由**:
- QuickJS WASM 是经过充分测试的成熟实现
- 完全对齐可确保 TypeScript 编译器逻辑与 QuickJS 一致
- 回归测试可防止新修改破坏已有功能
- 差异报告便于定位问题

### Decision 9: QuickJS WASM 源码调试支持

**选择**: 使用 DWARF 调试信息 + Chrome DevTools 集成

**编译参数**:
```bash
# Debug 构建 - 完整调试信息
emcc -g -O0 quickjs.c -o quickjs.wasm

# Release + 调试信息分离
emcc -g -O3 -fno-inline \
  -gseparate-dwarf=quickjs.debug.wasm \
  quickjs.c -o quickjs.wasm
```

**调试能力**:
- C/C++ 源码级断点
- 变量查看（原始名称而非 $local0）
- 调用栈追踪
- 内存检查

**理由**:
- Chrome DevTools 从 114 版本开始原生支持 WASM 调试
- DWARF 是 C/C++ 调试信息的标准格式
- 分离调试信息可保持生产包体积小
- 参考 [Chrome WASM Debugging 2020](https://developer.chrome.com/blog/wasm-debugging-2020)

**实现方式**:
- 更新 `scripts/buildWasm.ts` 添加 `-g` 标志
- 支持 `--debug-dwarf` 选项启用完整调试信息
- 支持 `--separate-dwarf` 选项分离调试信息
- 输出 `.wasm` 和 `.debug.wasm` 文件

### Decision 10: 字节码生成和运行架构

**选择**: 编译器生成字节码 + WASM 运行时执行 + 双重验证

**架构流程**:
```
                    ┌──────────────────┐
TypeScript Source → │ TS Bytecode      │ → bytecode_ts
                    │ Compiler         │
                    └──────────────────┘
                              │
                    ┌────────┬┴────────┐
                    │                   │
                    ▼                   ▼
          ┌──────────────┐   ┌──────────────┐
          │ 字节码对比   │   │ QuickJS WASM │
          │ (byte-by-  │   │ Runtime      │
          │  byte)     │   └──────┬───────┘
          └──────┬───────┘         │
                 │                 │
                 ▼                 ▼
          bytecode_ts      result_ts
          === bytecode_qjs ===
          result_ts ?        result_qjs ?
                 │                 │
                 └────────┬────────┘
                         ▼
                    PASS / FAIL
```

**双重验证机制**:

1. **字节码对齐验证**: TS 编译器生成的字节码与 QuickJS WASM 编译器生成的字节码按字节对比
2. **运行结果验证**: 使用 QuickJS WASM 运行时执行 TS 编译器生成的字节码，对比执行结果

**API 设计**:
```typescript
// 生成字节码
const bytecode_ts = compiler.compile(source, { target: 'es2020' });

// 使用 QuickJS WASM 运行时执行 TS 编译器生成的字节码
const runtime = await QuickJSWasm.create({ debug: true });
const result_ts = runtime.evalBytecode(bytecode_ts);

// 使用 QuickJS WASM 编译器生成基准字节码
const bytecode_qjs = runtime.compile(source);
const result_qjs = runtime.evalBytecode(bytecode_qjs);

// 双重验证
interface ValidationResult {
  bytecodeMatch: boolean;        // 字节码是否一致
  executionMatch: boolean;       // 执行结果是否一致
  bytecode: {
    ts: Uint8Array;
    qjs: Uint8Array;
    diffPositions?: number[];    // 不匹配的字节位置
  };
  execution: {
    ts: any;                     // TS 字节码执行结果
    qjs: any;                    // QJS 字节码执行结果
    error?: Error;               // 执行错误（如果有）
  };
}
```

**理由**:
- 分离编译和运行，便于独立测试
- 可与 QuickJS 原生编译器对比验证
- 支持字节码序列化和反序列化

## Risks / Trade-offs

### Risk 1: 字节码格式兼容性

**风险**: 生成的字节码可能与 QuickJS 不完全兼容

**缓解**: 
- 参考 `docs/quickjs/` 中的详细文档
- 使用 QuickJS WASM 进行对比测试
- 先实现核心功能，逐步扩展

### Risk 2: 复杂语法处理

**风险**: 某些复杂语法（如解构、generator）实现难度高

**缓解**:
- 按 `fixtures/` 分类逐步实现
- 从简单语法开始，逐步增加复杂度
- 参考 `docs/quickjs/syntax-to-bytecode/` 文档

### Risk 3: 性能

**风险**: TypeScript 实现可能比 C 实现慢

**缓解**:
- 首先保证正确性
- 使用高效数据结构（TypedArray 等）
- 后续可进行性能优化

### Risk 4: WASM 调试信息体积

**风险**: DWARF 调试信息可能很大

**缓解**:
- 使用 `-gseparate-dwarf` 分离调试信息
- 生产环境不包含调试信息
- 按需加载调试信息

## Migration Plan

### 阶段 1: 基础架构 (Week 1)
1. 类型定义和基础数据结构
2. TypeScript AST 适配器
3. 简单表达式发射

### 阶段 2: 核心编译 (Week 2-3)
1. 完整字节码发射器
2. 语句、函数、类发射
3. Phase 1 完整实现

### 阶段 3: 解析阶段 (Week 4-5)
1. resolve_variables 实现
2. resolve_labels 实现
3. 窥孔优化

### 阶段 4: WASM 调试支持 (Week 5)
1. 更新 buildWasm.ts 添加 DWARF 调试支持
2. 实现分离调试信息 (-gseparate-dwarf)
3. Chrome DevTools 集成验证

### 阶段 5: 输出和测试 (Week 6)
1. 字节码序列化
2. 完整测试覆盖
3. 与 QuickJS WASM 对比验证
4. 字节码运行验证

## Open Questions

1. **调试信息格式**: 是否需要完全兼容 QuickJS 的调试信息格式？
2. **增量编译**: 是否需要支持增量编译？
3. **Source Map**: 是否需要生成标准 Source Map？
4. **模块系统**: 是否需要支持 CommonJS，还是仅支持 ES Modules？

## References

- [docs/quickjs/architecture.md](../../docs/quickjs/architecture.md) - 核心架构
- [docs/quickjs/compilation-phases.md](../../docs/quickjs/compilation-phases.md) - 三阶段编译
- [docs/quickjs/opcode-reference.md](../../docs/quickjs/opcode-reference.md) - 操作码参考
- [docs/quickjs/syntax-to-bytecode/](../../docs/quickjs/syntax-to-bytecode/) - 语法映射
- [docs/quickjs/bytecode-functions/](../../docs/quickjs/bytecode-functions/) - 函数分析
- [Chrome WASM Debugging 2020](https://developer.chrome.com/blog/wasm-debugging-2020) - WASM 源码调试参考
