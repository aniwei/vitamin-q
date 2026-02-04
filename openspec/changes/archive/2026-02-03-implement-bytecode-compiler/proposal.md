# Change: 使用 TypeScript 实现 QuickJS 字节码编译器

## Why

Vitamin-Q 项目的核心目标是将 TypeScript/JavaScript 代码编译为 QuickJS 字节码。我们已经完成了 QuickJS 字节码内部机制的全面文档化（见 `docs/quickjs/`），包括：

- 254 个操作码的完整参考
- 三阶段编译流程的详细分析
- 语法到字节码的映射文档
- 关键函数的源码分析

现在需要基于这些文档，使用 TypeScript 实现一个可运行的字节码编译器，使项目从"理解阶段"进入"实现阶段"。

## What Changes

### 核心编译器实现
- **TypeScript AST 适配器**: 使用 TypeScript Compiler API 解析源码，将 `ts.Node` 转换为编译器内部表示
- **字节码发射器 (Emitter)**: 遍历 TypeScript AST 发射临时操作码序列
- **变量解析器 (VariableResolver)**: 实现 `resolve_variables` 算法
- **标签解析器 (LabelResolver)**: 实现 `resolve_labels` 算法和优化

### 数据结构定义
- **Opcode**: TypeScript 中的 254 个操作码枚举
- **JSFunctionDef**: 函数定义数据结构
- **BytecodeBuffer**: 字节码缓冲区管理
- **ConstantPool**: 常量池实现
- **ScopeChain**: 作用域链管理

### 输出格式
- QuickJS 兼容的 `.qjsc` 字节码格式
- 调试信息支持（源码映射、行号）

### QuickJS WASM 源码调试支持
- **DWARF 调试信息**: 编译 QuickJS 为 WASM 时包含完整的 DWARF 调试信息
- **Chrome DevTools 集成**: 支持在 Chrome DevTools 中进行 C/C++ 源码级调试
- **分离调试信息**: 支持 `-gseparate-dwarf` 将调试信息分离，减小生产包体积
- **参考文档**: [Chrome WASM Debugging 2020](https://developer.chrome.com/blog/wasm-debugging-2020)

### 字节码生成和运行
- **字节码生成**: TypeScript 编译器生成 QuickJS 兼容的字节码
- **字节码运行**: 通过 QuickJS WASM 运行时执行 TS 编译器生成的字节码
- **字节码对比**: 与 QuickJS WASM 编译器生成的字节码进行按字节对比
- **运行结果验证**: 对比 TS 字节码和 QuickJS 字节码的执行结果是否一致

### TypeScript 编译器验证机制
- **QuickJS WASM 作为基准**: 使用 QuickJS WASM 编译器作为字节码生成的权威参考
- **迭代验证**: 每次 TypeScript 编译器修改后，自动对比与 QuickJS WASM 生成的字节码
- **完全对齐验证**: 字节码必须完全一致（按字节对比），确保 TypeScript 编译器逻辑正确
- **运行时验证**: 使用 QuickJS WASM 运行 TS 编译器生成的字节码，验证执行结果正确
- **回归测试**: 防止新修改破坏已有功能，保持与基准一致

### C 源码对照实现
- **参照 QuickJS C 源码流程**: TypeScript 实现尽最大可能遵循 QuickJS C 源码的处理流程
- **结合 docs 文档**: 实现时参考 `docs/quickjs/` 中的详细文档
- **标注 C 源码位置**: 在 TypeScript 代码中标注对应的 C 源码文件和行号
- **便于对照调试**: 当字节码不一致时，可快速定位到 C 源码进行对比

### 类结构和命名规范
- **完全参照 QuickJS 字段**: TypeScript 类/接口的字段完全对应 QuickJS C 结构体字段
- **驼峰风格**: C 的下划线命名转换为 TypeScript 驼峰风格（如 `var_count` → `varCount`）
- **保持字段对应**: 确保每个 C 结构体字段在 TypeScript 中都有对应实现

### 枚举/常量自动生成
- **通过 QuickJS WASM 生成**: 操作码、常量等通过调用 `scripts/getEnv.ts` 从 QuickJS WASM 导出
- **确保完全对齐**: 枚举值、常量值直接从 QuickJS WASM 运行时获取，避免手动维护不一致
- **自动化更新**: 当 QuickJS 版本升级时，重新运行生成脚本即可同步更新
- **单元测试验证**: 测试验证导出的枚举/常量与 QuickJS WASM 完全一致

### 宏环境模拟
- **环境变量模拟宏**: 使用 `process.env.DEBUG`、`process.env.DUMP_BYTECODE` 等环境变量模拟 C 宏
- **条件编译模拟**: 支持 `DEBUG`、`DUMP_BYTECODE`、`DUMP_ATOMS` 等调试开关
- **运行时可配置**: 通过环境变量动态控制调试输出

### 编译器功能模块
- **语句调度模块 (AST Visitor)**: 遍历 TypeScript AST，根据节点类型分发到对应的处理器
- **字节码发射模块 (Emitter)**: 生成初始字节码，包含临时操作码
- **变量模块 (Variable)**: 作用域管理、变量解析、闭包分析
- **标签模块 (Label)**: 标签管理、跳转偏移计算、goto 重定位
- **字节码优化模块 (Optimizer)**: 窥孔优化、短操作码转换、死代码消除
- **调试信息模块 (Debug)**: PC 到行号映射 (pc2line)、源码映射
- **序列化模块 (Serializer)**: 字节码序列化输出、函数/模块序列化

### 测试框架
- 使用现有 `fixtures/` 目录的测试用例
- 与 QuickJS WASM 的输出对比验证
- **自动化回归测试**: 每次 CI/CD 运行时自动执行字节码对齐检查
- **差异报告**: 不匹配时生成详细的字节码差异报告

## Impact

### Affected Specs
- `quickjs-bytecode-internals`: 作为实现参考，不修改
- **新增** `bytecode-compiler`: 编译器功能规范

### Affected Code
- **新增** `src/compiler/`: 编译器核心模块
- **新增** `src/types/`: 类型定义
- **新增** `src/utils/`: 工具函数
- **修改** `scripts/buildWasm.ts`: 添加 DWARF 调试信息支持
- **修改** `package.json`: 添加依赖和脚本
- **修改** `tsconfig.json`: 调整编译配置

### 依赖关系
- 使用 TypeScript Compiler API（`typescript` 包）进行语法解析
- 使用现有 `fixtures/` 作为测试数据
- 可选：使用 QuickJS WASM 作为参考实现验证
