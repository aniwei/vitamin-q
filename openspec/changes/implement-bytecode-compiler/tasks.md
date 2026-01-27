# Tasks: TypeScript QuickJS 字节码编译器实现

> **重要约定**: 
> 1. 所有实现代码应参照 QuickJS C 源码流程，并在 JSDoc 注释中标注对应的 C 源码文件和行号
> 2. 标注格式: `@source quickjs.c:LINE` 或 `@source quickjs.c:START-END`，`@see FUNCTION_NAME`
> 3. **命名规范**: 类/接口字段完全对应 QuickJS C 结构体，使用驼峰风格（`var_count` → `varCount`）
> 4. **宏环境模拟**: 使用 `process.env.DEBUG`、`process.env.DUMP_BYTECODE` 等环境变量模拟 C 宏
> 5. **枚举/常量自动生成**: 操作码、常量等通过 `scripts/getEnv.ts` 从 QuickJS WASM 自动生成，确保完全对齐

## 1. 类型定义和基础架构

- [ ] 1.1 实现枚举/常量生成器 (`scripts/getEnv.ts`)
  - 从 QuickJS WASM 导出操作码定义
  - 从 QuickJS WASM 导出常量定义（原子、标志等）
  - 生成 TypeScript 枚举文件 `src/types/opcodes.generated.ts`
  - 生成 TypeScript 常量文件 `src/types/constants.generated.ts`
  - 添加 `@generated` 标记，标明不要手动修改

- [ ] 1.2 生成操作码枚举 (`src/types/opcodes.generated.ts`)
  - 通过 getEnv.ts 从 QuickJS WASM 自动生成
  - 254 个操作码的 const enum
  - OpcodeInfo 映射表（size, nPop, nPush, format）
  - **验证测试**: 确保与 QuickJS WASM 运行时完全对齐

- [ ] 1.3 生成常量定义 (`src/types/constants.generated.ts`)
  - 通过 getEnv.ts 从 QuickJS WASM 自动生成
  - 原子常量（JS_ATOM_*）
  - 标志常量（JS_PROP_*、JS_EVAL_*）
  - 类型标签常量

- [ ] 1.4 枚举/常量对齐单元测试 (`src/types/__tests__/alignment.test.ts`)
  - 验证 Opcode 枚举值与 QuickJS WASM 完全一致
  - 验证 OpcodeInfo 映射与 QuickJS WASM 完全一致
  - 验证常量值与 QuickJS WASM 完全一致
  - 任何不一致都导致测试失败

- [ ] 1.5 定义操作数格式 (`src/types/operand-format.ts`)
  - 所有操作数格式类型（none, u8, i8, u16, u32, atom 等）
  - 格式编解码函数

- [ ] 1.6 定义 JSFunctionDef (`src/types/function-def.ts`)
  - JSFunctionDef 完整结构，**字段完全对应 C 结构体**
  - **驼峰命名**: `var_count` → `varCount`, `arg_count` → `argCount` 等
  - JSVarDef, Scope, LabelSlot 等辅助结构
  - 参考 `docs/quickjs/architecture.md`
  - **标注 C 源码**: `@source quickjs.c` 中的 JSFunctionDef 结构体定义

- [ ] 1.7 定义字节码相关类型 (`src/types/bytecode.ts`)
  - BytecodeBuffer 接口
  - ConstantPool 接口
  - JSValue 类型表示

- [ ] 1.8 设置项目结构
  - 创建 `src/` 目录结构
  - 更新 `tsconfig.json`
  - 添加 `typescript` 依赖（用于 Compiler API）
  - 配置测试框架
  - 添加 `generate:types` 脚本运行 getEnv.ts

- [ ] 1.9 实现环境变量配置 (`src/config/env.ts`)
  - 定义 `Config` 对象模拟 C 宏
  - 支持 `DEBUG`、`DUMP_BYTECODE`、`DUMP_ATOMS` 等开关
  - 支持 `DUMP_CLOSURE`、`DUMP_SOURCE`、`DUMP_READ_OBJECT` 等
  - 通过 `process.env` 读取，运行时可配置
  - **标注 C 源码**: 对应 `#ifdef DEBUG` 等宏定义

## 2. 语句调度模块 (AST Visitor)

- [ ] 2.1 实现源码解析入口 (`src/ast/parser.ts`)
  - 使用 `ts.createSourceFile` 解析源码
  - 配置 ScriptTarget 为 ES2020
  - 支持 TypeScript 和 JavaScript 输入

- [ ] 2.2 实现 AST 遍历器 (`src/ast/visitor.ts`)
  - 基于 `ts.forEachChild` 的通用遍历器
  - 节点类型守卫工具函数
  - 遍历上下文管理

- [ ] 2.3 实现源码位置转换 (`src/ast/source-location.ts`)
  - ts.Node 位置到 line:column 转换
  - 源码范围管理
  - 调试信息生成支持

- [ ] 2.4 实现 AST 工具函数 (`src/ast/utils.ts`)
  - 节点类型检测辅助函数
  - 表达式类型判断
  - 语句分类工具

- [ ] 2.5 实现语句调度器 (`src/ast/dispatcher.ts`)
  - 根据节点类型分发到对应处理器
  - 表达式调度、语句调度、声明调度
  - 支持自定义处理器注册
  - **标注 C 源码**: 对应 js_parse_* 函数的分发逻辑

- [ ] 2.6 AST 适配层单元测试
  - 解析各类语法结构
  - 位置信息验证
  - TypeScript 特有语法处理验证
  - 调度器分发验证

## 3. 字节码发射模块 - Phase 1

- [ ] 3.1 实现字节码缓冲区 (`src/emitter/bytecode-buffer.ts`)
  - 动态增长的字节缓冲区
  - 写入 u8, u16, u32, i32 等
  - 标签占位符管理
  - **标注 C 源码**: 对应 DynBuf 相关函数

- [ ] 3.2 实现常量池管理 (`src/emitter/constant-pool.ts`)
  - cpool_add 实现
  - 常量去重
  - 索引管理
  - **标注 C 源码**: 对应 cpool_add 函数

- [ ] 3.3 实现标签管理 (`src/emitter/label-manager.ts`)
  - new_label, emit_label, emit_goto
  - 前向引用处理
  - 标签位置记录

- [ ] 3.4 实现主发射器 (`src/emitter/emitter.ts`)
  - emit_op, emit_u8, emit_u16, emit_u32
  - 基于 ts.Node 遍历发射字节码
  - 参考 `docs/quickjs/bytecode-functions/emit-functions.md`
  - **标注 C 源码**: 每个 emit 函数对应 quickjs.c 中的行号

- [ ] 3.5 实现表达式发射 (`src/emitter/expressions.ts`)
  - 字面量发射（NumericLiteral, StringLiteral, BigIntLiteral 等）
  - 运算符发射（BinaryExpression, UnaryExpression）
  - 函数调用发射（CallExpression）
  - 成员访问发射（PropertyAccessExpression, ElementAccessExpression）
  - 参考 `docs/quickjs/syntax-to-bytecode/expressions.md`
  - **标注 C 源码**: 对应 js_parse_expr, js_parse_unary 等函数

- [ ] 3.6 实现语句发射 (`src/emitter/statements.ts`)
  - 变量声明发射（VariableStatement）
  - 控制流发射（IfStatement, ForStatement, WhileStatement）
  - 异常处理发射（TryStatement）
  - 参考 `docs/quickjs/syntax-to-bytecode/statements.md`
  - **标注 C 源码**: 对应 js_parse_statement, js_parse_var 等函数

- [ ] 3.7 实现函数发射 (`src/emitter/functions.ts`)
  - 函数体编译（FunctionDeclaration, ArrowFunction）
  - 闭包创建
  - 参数初始化
  - 参考 `docs/quickjs/syntax-to-bytecode/functions.md`
  - **标注 C 源码**: 对应 js_parse_function_decl, js_emit_function 等函数

- [ ] 3.8 实现类发射 (`src/emitter/classes.ts`)
  - 类构建（ClassDeclaration）
  - 方法绑定
  - 字段初始化（含私有字段）
  - 参考 `docs/quickjs/syntax-to-bytecode/classes.md`
  - **标注 C 源码**: 对应 js_parse_class, js_emit_class 等函数

- [ ] 3.9 发射器单元测试
  - 操作码序列验证
  - 常量池验证
  - 标签引用验证

## 4. 变量模块 - Phase 2

- [ ] 4.1 实现作用域管理 (`src/variable/scope-manager.ts`)
  - push_scope, pop_scope
  - 变量定义和查找
  - 作用域链
  - **标注 C 源码**: `@source quickjs.c` 中的作用域相关函数

- [ ] 4.2 实现变量解析 (`src/variable/variable-resolver.ts`)
  - resolve_variables 主算法
  - scope_get_var → get_loc/get_arg/get_var_ref 转换
  - scope_put_var → put_loc/put_arg 转换
  - 参考 `docs/quickjs/bytecode-functions/resolve-variables.md`
  - **标注 C 源码**: `@source quickjs.c` 中的 resolve_variables 函数

- [ ] 4.3 实现闭包变量处理 (`src/variable/closure-analyzer.ts`)
  - add_closure_var
  - 闭包变量捕获检测
  - 参考 `docs/quickjs/bytecode-functions/closure-analysis.md`
  - **标注 C 源码**: `@source quickjs.c` 中的 add_closure_var 函数

- [ ] 4.4 变量解析器单元测试
  - 局部变量测试
  - 闭包测试
  - 全局变量测试

## 5. 标签模块 - Phase 3

- [ ] 5.1 实现标签管理 (`src/label/label-manager.ts`)
  - new_label, emit_label, emit_goto
  - 前向引用处理
  - 标签位置记录
  - **标注 C 源码**: `@source quickjs.c` 中的标签相关函数

- [ ] 5.2 实现标签解析 (`src/label/label-resolver.ts`)
  - resolve_labels 主算法
  - 跳转偏移计算
  - goto 指令重定位
  - 参考 `docs/quickjs/bytecode-functions/resolve-labels.md`
  - **标注 C 源码**: `@source quickjs.c` 中的 resolve_labels 函数

- [ ] 5.2 实现窥孔优化 (`src/optimizer/peephole.ts`)
  - 冗余操作消除
  - 短操作码转换（push_i32 → push_0 等）
  - 跳转优化
  - **标注 C 源码**: `@source quickjs.c` 中的优化相关代码

- [ ] 5.3 实现临时操作码移除
  - enter_scope, leave_scope 移除
  - 作用域相关指令处理

- [ ] 5.4 标签模块单元测试
  - 跳转偏移验证
  - 标签引用验证

## 5a. 字节码优化模块

- [ ] 5a.1 实现窥孔优化 (`src/optimizer/peephole.ts`)
  - 冗余操作消除
  - 跳转优化
  - **标注 C 源码**: `@source quickjs.c` 中的优化相关代码

- [ ] 5a.2 实现短操作码转换 (`src/optimizer/short-opcodes.ts`)
  - push_i32 → push_0/push_1/push_2 等
  - get_loc → get_loc0/get_loc1/get_loc2/get_loc3
  - put_loc → put_loc0/put_loc1/put_loc2/put_loc3
  - **标注 C 源码**: 对应短操作码转换逻辑

- [ ] 5a.3 实现死代码消除 (`src/optimizer/dead-code.ts`)
  - 不可达代码检测
  - 无用变量消除

- [ ] 5a.4 优化模块单元测试
  - 优化效果验证
  - 优化前后字节码对比

## 6. 调试信息模块

- [ ] 6.1 实现 PC 到行号映射 (`src/debug/pc2line.ts`)
  - debug_pc2line 算法实现
  - 字节码位置到源码行号的映射
  - 压缩行号表格式
  - **标注 C 源码**: `@source quickjs.c` 中的 pc2line 相关函数

- [ ] 6.2 实现源码映射生成 (`src/debug/source-map.ts`)
  - 源码位置映射
  - 变量名信息
  - 函数名映射

- [ ] 6.3 实现调试信息汇总 (`src/debug/debug-info.ts`)
  - 整合 pc2line 和 source-map
  - 调试信息序列化
  - 调试信息加载

- [ ] 6.4 调试信息模块单元测试
  - PC 到行号映射验证
  - 源码位置正确性验证

## 6a. 序列化模块

- [ ] 6a.1 实现字节码序列化 (`src/serializer/bytecode-writer.ts`)
  - QuickJS .qjsc 格式
  - 字节序序列化
  - **标注 C 源码**: `@source quickjs.c` 中的 js_write_* 函数

- [ ] 6a.2 实现函数字节码序列化 (`src/serializer/function-writer.ts`)
  - 函数头信息
  - 字节码序列
  - 常量池
  - 闭包变量信息

- [ ] 6a.3 实现模块字节码序列化 (`src/serializer/module-writer.ts`)
  - 模块元数据
  - 导入/导出信息
  - 模块依赖

- [ ] 6a.4 序列化模块单元测试
  - 格式正确性验证
  - 与 QuickJS 格式对比

## 7. 编译器集成

- [ ] 7.1 实现编译器入口 (`src/compiler.ts`)
  - compile 函数
  - 编译选项处理
  - 错误收集和报告

- [ ] 7.2 实现命令行接口 (`src/cli.ts`)
  - 文件编译命令
  - 输出选项
  - 调试选项

- [ ] 7.3 更新 package.json
  - 添加编译脚本
  - 添加测试脚本
  - 添加 typescript 依赖

## 8. QuickJS WASM 源码调试支持

- [ ] 8.1 更新 buildWasm.ts 添加 DWARF 调试支持
  - 添加 `-g` 编译标志支持
  - 添加 `--debug-dwarf` 命令行选项
  - Debug 构建默认启用调试信息

- [ ] 8.2 实现分离调试信息
  - 添加 `--separate-dwarf` 选项
  - 生成 `.debug.wasm` 文件
  - 配置 `SEPARATE_DWARF_URL` 指向本地文件

- [ ] 8.3 更新 CMakeLists.txt
  - 添加 DWARF 相关编译选项
  - 支持 Debug/Release 不同配置
  - 处理 `-fno-inline` 优化标志

- [ ] 8.4 Chrome DevTools 集成验证
  - 验证源码断点功能
  - 验证变量查看功能
  - 验证调用栈追踪
  - 文档化调试流程

## 9. 字节码运行支持

- [ ] 9.1 实现字节码运行接口 (`src/runtime/runner.ts`)
  - 加载 QuickJS WASM 模块
  - 执行编译后的字节码
  - 返回执行结果

- [ ] 9.2 实现字节码对比验证 (`src/runtime/comparator.ts`)
  - 比较 TS 编译器生成的字节码与 QuickJS WASM 编译器
  - **按字节完全对比**，非功能等价
  - 生成详细的差异报告（不匹配字节位置、十六进制对比）

- [ ] 9.2a 实现运行时验证 (`src/runtime/execution-validator.ts`)
  - 使用 QuickJS WASM 运行时执行 TS 编译器生成的字节码
  - 对比 TS 字节码和 QuickJS 字节码的执行结果
  - 验证返回值、异常和副作用是否一致

- [ ] 9.3 更新 scripts/QuickJSLib.ts
  - 添加字节码编译 API
  - 添加字节码执行 API
  - 添加字节码序列化/反序列化

- [ ] 9.4 字节码运行单元测试
  - 简单表达式运行验证
  - 函数调用运行验证
  - 错误处理验证
  - **TS 字节码 vs QuickJS 字节码执行结果对比**

## 10. 字节码对齐验证框架

- [ ] 10.1 实现自动化对齐测试 (`src/test/alignment-test.ts`)
  - 遍历所有 fixtures 目录
  - 对每个 fixture 同时使用 TS 编译器和 QuickJS WASM 编译
  - 按字节对比两者输出的字节码
  - **运行两者生成的字节码并对比执行结果**

- [ ] 10.2 实现差异报告生成器 (`src/test/diff-reporter.ts`)
  - 生成可读的字节码差异报告
  - 显示不匹配的字节位置和上下文
  - 支持 JSON 和文本格式输出

- [ ] 10.3 实现 CI/CD 集成
  - 每次提交自动运行对齐测试
  - 任何字节码不匹配则构建失败
  - 生成测试覆盖率报告

- [ ] 10.4 实现回归测试机制
  - 保存已通过的 fixture 字节码快照
  - 检测新修改是否破坏已有功能
  - 支持批量更新快照（当 QuickJS 版本升级时）

## 11. 测试和验证

- [ ] 11.1 单元测试完善
  - 各模块测试覆盖率 > 80%
  - 边界情况覆盖

- [ ] 11.2 Fixtures 集成测试
  - 编译 fixtures/basic/ 所有文件
  - 编译 fixtures/es2020/ 所有文件
  - 验证编译成功率

- [ ] 11.3 QuickJS WASM 字节码对齐测试
  - 运行自动化对齐测试框架
  - 所有 fixtures 必须完全对齐
  - 生成对齐测试报告
  - **执行结果验证报告**（TS 字节码运行结果 vs QuickJS 字节码运行结果）

- [ ] 11.4 性能测试
  - 编译时间基准
  - 内存使用监控
  - 大文件测试

## 12. 文档和清理

- [ ] 12.1 API 文档
  - 编译器 API 文档
  - 类型定义文档
  - 使用示例

- [ ] 12.2 WASM 调试文档
  - Chrome DevTools 调试指南
  - DWARF 调试信息说明
  - 常见问题解答

- [ ] 12.3 字节码对齐验证文档
  - 验证机制说明
  - 如何添加新 fixture
  - 故障排除指南

- [ ] 12.4 架构文档
  - 模块关系图
  - 数据流图
  - 扩展指南

- [ ] 12.5 代码清理
  - 删除调试代码
  - 统一代码风格
  - 添加必要注释
