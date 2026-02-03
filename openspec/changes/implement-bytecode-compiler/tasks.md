# Tasks: TypeScript QuickJS 字节码编译器实现

> **重要约定**: 
> 1. 所有实现代码应参照 QuickJS C 源码流程，并在 JSDoc 注释中标注对应的 C 源码文件和行号
> 2. 标注格式: `@source quickjs.c:LINE` 或 `@source quickjs.c:START-END`，`@see FUNCTION_NAME`
> 3. **命名规范**: 类/接口字段完全对应 QuickJS C 结构体，使用驼峰风格（`var_count` → `varCount`）
> 4. **宏环境模拟**: 使用 `process.env.DEBUG`、`process.env.DUMP_BYTECODE` 等环境变量模拟 C 宏
> 5. **枚举/常量自动生成**: 操作码、常量等通过 `scripts/getEnv.ts` 从 QuickJS WASM 自动生成，确保完全对齐
> 6. **实现校验**: 每次完成任务时必须核对实现严格参照 `docs/` 分析文档与 `third_party/QuickJS` 源码
> 7. **测试门禁**: 完成包含 TypeScript 编译功能迭代的任务时，必须运行单元测试，并执行 fixtures 的 WASM 编译字节码与 TypeScript 编译字节码对照测试；结果须完全一致才视为完成
> 8. **WASM 运行验证**: 若涉及 TypeScript 编译功能迭代，需使用 WASM 运行 TypeScript 编译后的 fixtures 字节码

## 状态更新（2026-02-03）

- ✅ 已完成第 1–7a 节（类型/基础架构、AST 调度、Phase 1 发射模块、变量/Atom/控制流、标签/优化/IC、调试/序列化、编译器/模块）
- ✅ 已完成 8.1–8.4 DWARF 调试构建支持与调试流程文档
- ✅ 已完成 9.x 字节码运行支持（运行/对比/验证/测试）
- ✅ 已完成 10.x 对齐验证框架与 CI 集成
- ✅ 已完成 11.2–11.4 集成/对齐/性能测试脚本
- ✅ 已完成 12.1–12.4 文档
- ✅ 已完成 12.5 代码清理
- ✅ 已补齐 control-flow/optimizer/module/serializer/compiler 的 WASM 绑定与对比测试
- ✅ 已完成 11.1 覆盖率（测试覆盖率 > 80%）
- ✅ 已运行单元测试与覆盖率

## 1. 类型定义和基础架构

- [x] 1.1 实现枚举/常量生成器 (`scripts/getEnv.ts`)
  - 从 QuickJS WASM 导出操作码定义
  - 从 QuickJS WASM 导出常量定义（原子、标志等）
  - 生成 TypeScript 环境文件 `src/env.ts`
  - 添加 `@generated` 标记，标明不要手动修改

- [x] 1.2 生成操作码枚举（`src/env.ts`）
  - 通过 getEnv.ts 从 QuickJS WASM 自动生成
  - OP_COUNT 主操作码 + OP_TEMP_* 临时操作码
  - short opcode 映射（SHORT_OPCODES）
  - OpcodeInfo 映射表（size, nPop, nPush, format）
  - **验证测试**: 确保与 QuickJS WASM 运行时完全对齐

- [x] 1.3 生成常量定义（`src/env.ts`）
  - 通过 getEnv.ts 从 QuickJS WASM 自动生成
  - 原子常量（JS_ATOM_*）
  - 标志常量（JS_PROP_*、JS_EVAL_*）
  - OP_SPECIAL_OBJECT_* 与 JS_THROW_* 常量
  - PC2LINE_* 压缩表常量
  - 类型标签常量

- [x] 1.4 枚举/常量对齐单元测试 (`src/types/__tests__/alignment.test.ts`)
  - 验证 Opcode 枚举值与 QuickJS WASM 完全一致
  - 验证 OpcodeInfo 映射与 QuickJS WASM 完全一致
  - 验证常量值与 QuickJS WASM 完全一致
  - 任何不一致都导致测试失败

- [x] 1.5 定义操作数格式 (`src/types/operand-format.ts`)
  - 所有操作数格式类型（none, u8, i8, u16, u32, atom 等）
  - atom_label_u8/atom_label_u16 等复合格式
  - label16/label_u16/npop_u16 等扩展格式
  - 格式编解码函数

- [x] 1.6 定义 JSFunctionDef (`src/types/function-def.ts`)
  - JSFunctionDef 完整结构，**字段完全对应 C 结构体**
  - **驼峰命名**: `var_count` → `varCount`, `arg_count` → `argCount` 等
  - JSVarDef: 变量定义（var_name, scope_level, scope_next, var_kind 等）
  - JSVarScope: 作用域定义（parent, first）
  - LabelSlot: 标签槽（ref_count, pos, pos2, addr, first_reloc）
  - RelocEntry: 重定位条目（addr, size, next）
  - JumpSlot: 跳转槽（op, size, pos, label）
  - LineNumberSlot, ColumnNumberSlot: 行列号槽
  - JSClosureVar: 闭包变量
  - JSParseFunctionEnum, JSParseExportEnum 枚举
  - strip_debug/strip_source 与 source/filename/source_pos
  - pc2line/pc2column DynBuf 与 line/column slots
  - 参考 `docs/quickjs/architecture.md`
  - **标注 C 源码**: `@source parser.h` 中的结构体定义

- [x] 1.6a 定义 JSFunctionBytecode (`src/types/function-bytecode.ts`)
  - JSFunctionBytecode 完整结构
  - 字节码头标志位
  - has_debug/read_only_bytecode/is_direct_or_indirect_eval
  - byte_code_buf, byte_code_len
  - vardefs, closure_var
  - cpool（常量池）
  - debug 信息结构
  - **标注 C 源码**: `@source types.h` 中的 JSFunctionBytecode

- [x] 1.6b 定义模块相关类型 (`src/types/module.ts`)
  - JSImportEntry, JSExportEntry, JSStarExportEntry, JSReqModuleEntry
  - JSExportTypeEnum, JSModuleStatus
  - JSModuleDef 完整结构（含 async/tla 状态字段）
  - **标注 C 源码**: `@source types.h` 中的模块结构定义

- [x] 1.7 定义字节码相关类型 (`src/types/bytecode.ts`)
  - BytecodeBuffer 接口
  - ConstantPool 接口
  - JSValue 类型表示

- [x] 1.8 设置项目结构
  - 创建 `src/` 目录结构
  - 更新 `tsconfig.json`
  - 添加 `typescript` 依赖（用于 Compiler API）
  - 配置测试框架
  - 添加 `generate:types` 脚本运行 getEnv.ts

- [x] 1.9 实现环境变量配置 (`src/config/env.ts`)
  - 定义 `Config` 对象模拟 C 宏
  - 支持 `DEBUG`、`DUMP_BYTECODE`、`DUMP_ATOMS` 等开关
  - 支持 `DUMP_CLOSURE`、`DUMP_SOURCE`、`DUMP_READ_OBJECT` 等
  - 通过 `process.env` 读取，运行时可配置
  - **标注 C 源码**: 对应 `#ifdef DEBUG` 等宏定义

## 2. 语句调度模块 (AST Visitor)

- [x] 2.1 实现源码解析入口 (`src/ast/parser.ts`)
  - 使用 `ts.createSourceFile` 解析源码
  - 配置 ScriptTarget 为 ES2020
  - 支持 TypeScript 和 JavaScript 输入

- [x] 2.2 实现 AST 遍历器 (`src/ast/visitor.ts`)
  - 基于 `ts.forEachChild` 的通用遍历器
  - 节点类型守卫工具函数
  - 遍历上下文管理

- [x] 2.3 实现源码位置转换 (`src/ast/source-location.ts`)
  - ts.Node 位置到 line:column 转换
  - 源码范围管理
  - 调试信息生成支持
  - get_line_col_cached 等价实现（增量计算行列）
  - 错误位置映射（语法错误定位）

- [x] 2.4 实现 AST 工具函数 (`src/ast/utils.ts`)
  - 节点类型检测辅助函数
  - 表达式类型判断
  - 语句分类工具

- [x] 2.5 实现语句调度器 (`src/ast/dispatcher.ts`)
  - 根据节点类型分发到对应处理器
  - 表达式调度、语句调度、声明调度
  - 支持自定义处理器注册
  - **标注 C 源码**: 对应 js_parse_* 函数的分发逻辑

- [x] 2.6 AST 适配层单元测试
  - 解析各类语法结构
  - 位置信息验证
  - TypeScript 特有语法处理验证
  - 调度器分发验证

## 3. 字节码发射模块 - Phase 1

- [x] 3.1 实现字节码缓冲区 (`src/emitter/bytecode-buffer.ts`)
  - 动态增长的字节缓冲区
  - 写入 u8, u16, u32, i32 等
  - 标签占位符管理
  - **标注 C 源码**: 对应 DynBuf 相关函数

- [x] 3.2 实现常量池管理 (`src/emitter/constant-pool.ts`)
  - cpool_add 实现
  - 常量去重
  - 索引管理
  - **标注 C 源码**: 对应 cpool_add 函数

- [x] 3.3 实现标签管理 (`src/emitter/label-manager.ts`)
  - new_label, emit_label, emit_goto
  - 前向引用处理
  - 标签位置记录

- [x] 3.4 实现主发射器 (`src/emitter/emitter.ts`)
  - emit_op, emit_u8, emit_u16, emit_u32
  - emit_source_pos（OP_line_num 插入）
  - emit_atom（JS_DupAtom 编码写入）
  - emit_ic（Inline Cache 记录）
  - 基于 ts.Node 遍历发射字节码
  - 参考 `docs/quickjs/bytecode-functions/emit-functions.md`
  - **标注 C 源码**: 每个 emit 函数对应 quickjs.c 中的行号

- [x] 3.5 实现表达式发射 (`src/emitter/expressions.ts`)
  - 字面量发射（NumericLiteral, StringLiteral, BigIntLiteral 等）
  - emit_push_const: 常量推送（支持 as_atom 优化）
  - 运算符发射（BinaryExpression, UnaryExpression）
  - 条件表达式（ConditionalExpression）
  - 函数调用发射（CallExpression）
  - eval 调用检测（has_eval_call 标记）
  - 成员访问发射（PropertyAccessExpression, ElementAccessExpression）
  - super 属性访问（OP_get_super, OP_get_super_value, OP_put_super_value）
  - import.meta 发射（OP_special_object IMPORT_META）
  - 动态 import 发射（OP_import）
  - 模板字面量（TemplateExpression）
  - 展开运算符（SpreadElement, js_emit_spread_code）
  - 参考 `docs/quickjs/syntax-to-bytecode/expressions.md`
  - **标注 C 源码**: 对应 js_parse_expr, js_parse_unary, js_parse_postfix_expr 等函数

- [x] 3.5a 实现赋值表达式发射 (`src/emitter/assignment.ts`)
  - js_parse_assign_expr2 对应逻辑
  - 复合赋值运算符（+=, -=, *=, /= 等）
  - 逻辑赋值运算符（&&=, ||=, ??=）
  - 解构赋值发射
  - **标注 C 源码**: `@source parser.c` 中的 js_parse_assign_expr2

- [x] 3.5b 实现对象/数组字面量发射 (`src/emitter/literals.ts`)
  - js_parse_object_literal: 对象字面量
  - js_parse_array_literal: 数组字面量
  - 计算属性名处理
  - getter/setter 方法处理
  - **标注 C 源码**: `@source parser.c` 中的 js_parse_object_literal, js_parse_array_literal

- [x] 3.6 实现语句发射 (`src/emitter/statements.ts`)
  - 变量声明发射（VariableStatement: var/let/const）
  - 控制流发射（IfStatement, ForStatement, WhileStatement, DoStatement）
  - for-in/for-of 发射
  - switch 语句发射
  - 异常处理发射（TryStatement: try-catch-finally）
  - gosub/ret/finally 跳转序列
  - break/continue 发射
  - return/throw 发射
  - with 语句发射
  - debugger 语句发射
  - 参考 `docs/quickjs/syntax-to-bytecode/statements.md`
  - **标注 C 源码**: 对应 js_parse_statement_or_decl 等函数

- [x] 3.6a 实现解构模式发射 (`src/emitter/destructuring.ts`)
  - 数组解构发射
  - 对象解构发射
  - 嵌套解构
  - 默认值处理
  - 剩余元素（rest element）
  - **标注 C 源码**: 对应解构相关发射逻辑

- [x] 3.7 实现函数发射 (`src/emitter/functions.ts`)
  - js_new_function_def: 创建函数定义
  - js_parse_function_decl2: 函数声明/表达式解析
  - 函数体编译（FunctionDeclaration, ArrowFunction, FunctionExpression）
  - 闭包创建（fclosure 操作码）
  - 参数初始化（含默认参数、剩余参数）
  - arguments 对象处理（普通/映射模式）
  - this 绑定处理
  - new.target 处理
  - home_object 处理（方法中的 super）
  - 参考 `docs/quickjs/syntax-to-bytecode/functions.md`
  - **标注 C 源码**: 对应 js_new_function_def, js_parse_function_decl2 等函数
  - [x] 参数初始化对齐（默认参数/剩余参数/解构参数）
  - [x] arrow 函数 `arguments` 绑定外层
  - [x] `arguments` 映射模式
  - [x] `this`/`new.target`/`home_object` 细节对齐

- [x] 3.7a 实现生成器函数发射 (`src/emitter/generators.ts`)
  - Generator 函数编译
  - yield 表达式发射
  - yield* 委托发射
  - **标注 C 源码**: 对应生成器相关发射逻辑

- [x] 3.7b 实现异步函数发射 (`src/emitter/async.ts`)
  - async 函数编译
  - await 表达式发射
  - async generator 函数
  - **标注 C 源码**: 对应异步函数相关发射逻辑
  - [x] await 表达式发射对齐
  - [x] for-await-of 语句发射对齐
  - [x] async yield* 展开逻辑对齐

- [x] 3.8 实现类发射 (`src/emitter/classes.ts`)
  - js_parse_class: 类解析主函数
  - 类构建（ClassDeclaration, ClassExpression）
  - 构造函数处理（含派生类构造函数）
  - js_parse_class_default_ctor: 默认构造函数生成
  - 方法绑定（实例方法、静态方法）
  - define_method / define_method_computed 操作码发射
  - 字段初始化（实例字段、静态字段）
  - js_parse_function_class_fields_init: 字段初始化函数
  - private_symbol 创建与绑定
  - check_brand / add_brand 处理
  - 私有字段/方法处理
  - getter/setter 处理
  - extends 继承处理
  - super 调用处理
  - set_class_name 临时操作码处理
  - 参考 `docs/quickjs/syntax-to-bytecode/classes.md`
  - **标注 C 源码**: 对应 js_parse_class, js_parse_class_default_ctor 等函数

- [x] 3.9 发射器单元测试
  - [x] 操作码序列验证
  - [x] 常量池验证
  - [x] 标签引用验证
  - [x] 函数体 wasm 对齐（return/rest/await/for-await-of）
  - [x] async yield* wasm 对齐
  - [x] generator yield/yield* wasm 对齐
  - [x] async generator yield wasm 对齐
  - [x] generator/async generator return/empty wasm 对齐
  - [x] async generator for-await-of wasm 对齐
  - [x] expressions wasm 对齐
  - [x] literals spread/__proto__ wasm 对齐

## 3a. 正则表达式处理模块

- [x] 3a.1 实现正则表达式解析 (`src/emitter/regexp.ts`)
  - js_parse_regexp: 正则表达式字面量解析
  - 正则表达式标志处理
  - OP_regexp 操作码发射
  - **标注 C 源码**: `@source parser.c` 中的 js_parse_regexp

- [x] 3a.2 正则表达式单元测试
  - 正则字面量编译测试
  - 标志解析测试

## 4. 变量模块 - Phase 2

- [x] 4.1 实现作用域管理 (`src/variable/scope-manager.ts`)
  - push_scope, pop_scope
  - 变量定义（add_var, add_scope_var）
  - 变量查找（find_var, find_arg）
  - 作用域链遍历
  - close_scopes: 关闭作用域释放资源
  - **标注 C 源码**: `@source parser.c` 中的作用域相关函数

- [x] 4.2 实现变量解析 (`src/variable/variable-resolver.ts`)
  - resolve_variables 主算法
  - resolve_scope_var: 作用域变量解析
  - scope_get_var → get_loc/get_arg/get_var_ref 转换
  - scope_put_var → put_loc/put_arg/put_var_ref 转换
  - scope_get_var_checkthis 处理（派生类 this 规则）
  - set_class_name 临时操作码处理
  - scope_make_ref / scope_get_ref 处理
  - optimize_scope_make_ref: 引用优化
  - optimize_scope_make_global_ref: 全局引用优化
  - 参考 `docs/quickjs/bytecode-functions/resolve-variables.md`
  - **标注 C 源码**: `@source parser.c` 中的 resolve_variables, resolve_scope_var

- [x] 4.3 实现闭包变量处理 (`src/variable/closure-analyzer.ts`)
  - add_closure_var: 添加闭包变量
  - 闭包变量捕获检测（is_captured 标记）
  - 闭包变量链接（parent function → child function）
  - add_closure_variables: 批量添加闭包变量
  - 参考 `docs/quickjs/bytecode-functions/closure-analysis.md`
  - **标注 C 源码**: `@source parser.c` 中的 add_closure_var, add_closure_variables

- [x] 4.4 变量解析器单元测试
  - 局部变量测试
  - 闭包测试
  - 全局变量测试
  - 作用域链测试

## 4a. Atom 管理模块

- [x] 4a.1 实现 Atom 表管理 (`src/atom/atom-table.ts`)
  - AtomTable 类实现
  - 字符串内部化（string interning）
  - 哈希表存储和查找
  - atom_hash 扩容与重建
  - atom_array free list 管理
  - 支持预定义原子（JS_ATOM_* 常量）
  - 支持私有/符号 atom（JS_ATOM_TYPE_PRIVATE/JS_ATOM_TYPE_SYMBOL）
  - **标注 C 源码**: `@source quickjs.c` 中的 JSAtomStruct, atom_hash, __JS_NewAtom

- [x] 4a.2 实现 Atom 创建和查找 (`src/atom/atom-ops.ts`)
  - JS_NewAtom: 创建或获取 atom
  - JS_NewAtomLen: 从字符串长度创建
  - JS_AtomToString: atom 转字符串
  - JS_AtomToValue: atom 转 JSValue
  - tagged int atom（__JS_AtomIsTaggedInt/JS_NewAtomUInt32）支持
  - **标注 C 源码**: `@source quickjs.c` 中的 JS_NewAtom, JS_NewAtomLen 等函数

- [x] 4a.3 实现预定义 Atom 初始化 (`src/atom/predefined-atoms.ts`)
  - 初始化 QuickJS 预定义原子表
  - JS_ATOM_NULL, JS_ATOM_undefined, JS_ATOM_length 等
  - 确保与 QuickJS 运行时完全对齐
  - **从 WASM 自动生成**: 通过 getEnv.ts 导出预定义原子列表

- [x] 4a.4 实现 Atom 序列化 (`src/atom/atom-serializer.ts`)
  - Atom 到字节码序列化
  - 字节码中的 atom 引用编码
  - atom_index 写入和读取
  - **标注 C 源码**: `@source quickjs.c` 中的 bc_put_atom, bc_get_atom

- [x] 4a.5 实现 Atom 与变量名集成 (`src/atom/atom-variable.ts`)
  - 变量名 → Atom 转换
  - 属性名 → Atom 转换
  - 函数名/类名 → Atom 转换
  - emit_atom 操作码发射

- [x] 4a.6 Atom 模块单元测试
  - Atom 创建和查找测试
  - 字符串内部化重复检测
  - 预定义 Atom 对齐验证
  - 序列化/反序列化测试

## 4b. 控制流环境模块 (BlockEnv)

- [x] 4b.1 实现 BlockEnv 结构 (`src/control-flow/block-env.ts`)
  - BlockEnv 链表结构
  - 支持 label_name, label_break, label_cont
  - drop_count 栈元素计数
  - label_finally 支持 try-finally
  - **标注 C 源码**: `@source parser.h` 中的 BlockEnv 结构体

- [x] 4b.2 实现控制流环境管理 (`src/control-flow/block-manager.ts`)
  - push_block_env, pop_block_env
  - 查找 break/continue 目标标签
  - 处理 finally 块跳转
  - **标注 C 源码**: 对应控制流环境管理函数

- [x] 4b.3 实现 with 语句作用域 (`src/control-flow/with-scope.ts`)
  - has_with_scope 检测
  - get_with_scope_opcode 转换
  - **标注 C 源码**: `@source parser.c` 中的 with 相关函数

- [x] 4b.4 BlockEnv 模块单元测试
  - break/continue 标签解析
  - try-finally 跳转测试
  - 嵌套块环境测试

## 4c. 全局变量模块

- [x] 4c.1 实现 JSGlobalVar 结构 (`src/variable/global-var.ts`)
  - JSGlobalVar 结构定义
  - force_init, is_lexical, is_const 标志
  - cpool_idx 函数提升索引
  - **标注 C 源码**: `@source parser.h` 中的 JSGlobalVar

- [x] 4c.2 实现全局变量管理 (`src/variable/global-var-manager.ts`)
  - add_global_var
  - find_global_var
  - 全局变量定义检查（check_define_var）
  - **标注 C 源码**: 对应全局变量管理函数

- [x] 4c.3 实现 eval 变量处理 (`src/variable/eval-variables.ts`)
  - add_eval_variables
  - mark_eval_captured_variables
  - eval 闭包变量捕获
  - **标注 C 源码**: `@source parser.c` 中的 add_eval_variables

- [x] 4c.4 全局变量模块单元测试
  - 全局变量定义测试
  - eval 变量捕获测试

## 4d. 私有字段模块

- [x] 4d.1 实现私有字段解析 (`src/variable/private-field.ts`)
  - resolve_scope_private_field
  - 私有字段查找和验证
  - 私有方法/访问器处理
  - **标注 C 源码**: `@source parser.c` 中的 resolve_scope_private_field

- [x] 4d.2 实现私有字段发射 (`src/emitter/private-field.ts`)
  - OP_get_private_field
  - OP_put_private_field
  - OP_define_private_field
  - OP_scope_in_private_field
  - **标注 C 源码**: 对应私有字段操作码发射

- [x] 4d.3 私有字段模块单元测试
  - 私有字段访问测试
  - 私有方法测试
  - 私有 getter/setter 测试

## 5. 标签模块 - Phase 3

- [x] 5.1 实现标签管理 (`src/label/label-manager.ts`)
  - new_label, emit_label, emit_goto
  - emit_label_raw（不更新 last opcode）
  - update_label/get_label_pos
  - 前向引用处理（RelocEntry 链表）
  - 标签位置记录（pos, pos2, addr 三阶段）
  - **标注 C 源码**: `@source parser.c` 中的 new_label, emit_label 等

- [x] 5.2 实现标签解析 (`src/label/label-resolver.ts`)
  - resolve_labels 主算法
  - 跳转偏移计算和回填
  - goto 指令重定位
  - 尾调用检测和转换
  - 参考 `docs/quickjs/bytecode-functions/resolve-labels.md`
  - **标注 C 源码**: `@source parser.c` 中的 resolve_labels 函数

- [x] 5.3 实现临时操作码移除
  - OP_label/OP_line_num 临时操作码处理
  - OP_enter_scope, OP_leave_scope 移除
  - OP_set_class_name 移除
  - 作用域相关指令处理

- [x] 5.4 实现栈大小计算 (`src/label/stack-size.ts`)
  - compute_stack_size 算法
  - 模拟执行计算最大栈深度
  - 栈溢出检测
  - 使用 opcode_info/short_opcode_info 的 n_pop/n_push
  - **标注 C 源码**: `@source parser.c` 中的 compute_stack_size

- [x] 5.5 标签模块单元测试
  - 跳转偏移验证
  - 标签引用验证
  - 栈大小计算验证

## 5a. 字节码优化模块

- [x] 5a.1 实现窥孔优化 (`src/optimizer/peephole.ts`)
  - 冗余操作消除（drop before return_undef）
  - 连续跳转优化（goto chain optimization）
  - 尾调用转换（call + return → tail_call）
  - CodeContext + code_match 辅助匹配
  - **标注 C 源码**: `@source parser.c` 中的优化相关代码

- [x] 5a.2 实现短操作码转换 (`src/optimizer/short-opcodes.ts`)
  - push_i32 → push_0/push_1/push_2/push_minus_one 等
  - get_loc → get_loc0/get_loc1/get_loc2/get_loc3
  - put_loc → put_loc0/put_loc1/put_loc2/put_loc3
  - set_loc → set_loc0/set_loc1/set_loc2/set_loc3
  - get_arg → get_arg0/get_arg1/get_arg2/get_arg3
  - set_arg → set_arg0/set_arg1/set_arg2/set_arg3
  - get_var_ref/put_var_ref/set_var_ref 短码
  - call → call0/call1/call2/call3
  - goto → goto8/goto16（短跳转）
  - put_short_code 函数实现
  - **标注 C 源码**: 对应 put_short_code 和短操作码转换逻辑

- [x] 5a.3 实现死代码消除 (`src/optimizer/dead-code.ts`)
  - skip_dead_code 实现
  - 不可达代码检测（return/throw/goto 后）
  - 死代码标签引用更新
  - **标注 C 源码**: `@source parser.c` 中的 skip_dead_code

- [x] 5a.4 优化模块单元测试
  - 优化效果验证
  - 优化前后字节码对比
  - 短操作码转换验证

## 5b. Inline Cache (IC) 模块

- [x] 5b.1 实现 InlineCache 结构 (`src/ic/inline-cache.ts`)
  - InlineCache 类实现
  - InlineCacheRingSlot 环形缓存槽
  - InlineCacheHashSlot 哈希索引
  - **标注 C 源码**: `@source ic.h/ic.cpp` 中的 InlineCache 结构

- [x] 5b.2 实现 IC 操作函数 (`src/ic/ic-ops.ts`)
  - init_ic: 初始化内联缓存
  - add_ic_slot1: 添加缓存槽
  - rebuild_ic: 重建缓存
  - free_ic: 释放缓存
  - **标注 C 源码**: `@source ic.cpp` 中的 IC 函数

- [x] 5b.3 实现 emit_ic 发射 (`src/emitter/ic-emitter.ts`)
  - emit_ic 在属性访问时记录 atom
  - IC 索引写入字节码
  - **标注 C 源码**: `@source parser.c` 中的 emit_ic

- [x] 5b.4 IC 模块单元测试
  - IC 初始化测试
  - 属性访问 IC 记录测试

## 6. 调试信息模块

- [x] 6.1 实现 PC 到行号映射 (`src/debug/pc2line.ts`)
  - add_pc2line_info 记录映射
  - pc2line 压缩编码（差分编码）
  - 字节码位置到源码行号的映射
  - **标注 C 源码**: `@source parser.c` 中的 add_pc2line_info

- [x] 6.2 实现 PC 到列号映射 (`src/debug/pc2column.ts`)
  - add_pc2column_info 记录映射
  - pc2column 压缩编码
  - 字节码位置到源码列号的映射
  - **标注 C 源码**: `@source parser.c` 中的 pc2column 相关函数

- [x] 6.3 实现源码映射生成 (`src/debug/source-map.ts`)
  - source_pos 记录（相对于 buf_start 的偏移）
  - LineNumberSlot/ColumnNumberSlot 结构
  - line_number_slots 和 column_number_slots 管理
  - **标注 C 源码**: `@source parser.h` 中的 LineNumberSlot

- [x] 6.4 实现字节码转储 (`src/debug/bytecode-dump.ts`)
  - dump_byte_code 实现
  - 操作码反汇编
  - 常量池显示
  - 变量信息显示
  - dump_pc2line/dump_pc2column 辅助
  - 支持 DUMP_BYTECODE 环境变量
  - **标注 C 源码**: `@source parser.c` 中的 dump_byte_code

- [x] 6.5 调试信息模块单元测试
  - PC 到行号映射验证
  - PC 到列号映射验证
  - 字节码转储输出验证

## 6a. 序列化模块

- [x] 6a.1 实现字节码写入器 (`src/serializer/bytecode-writer.ts`)
  - BCWriterState 状态管理
  - bc_put_u8, bc_put_u16, bc_put_u32, bc_put_u64
  - bc_put_leb128, bc_put_sleb128 变长编码
  - 字节序处理（大小端转换）
  - bc_set_flags 与位打包
  - bc_byte_swap（端序转换）
  - **标注 C 源码**: `@source bytecode.cpp` 中的 bc_put_* 函数

- [x] 6a.2 实现 Atom 序列化 (`src/serializer/atom-writer.ts`)
  - bc_atom_to_idx: atom 到索引映射
  - bc_put_atom: 写入 atom 引用
  - idx_to_atom 数组管理
  - JS_WriteObjectAtoms: 写入 atom 表
  - **标注 C 源码**: `@source bytecode.cpp` 中的 bc_atom_to_idx, bc_put_atom

- [x] 6a.3 实现函数字节码序列化 (`src/serializer/function-writer.ts`)
  - JS_WriteFunctionTag 实现
  - 函数头标志位编码（bc_set_flags）
  - vardefs 序列化
  - closure_var 序列化
  - JS_WriteFunctionBytecode: 字节码序列化（atom 替换）
  - 调试信息序列化（pc2line_buf, source）
  - debug source 中的 IC atom 列表
  - **标注 C 源码**: `@source bytecode.cpp` 中的 JS_WriteFunctionTag

- [x] 6a.4 实现模块序列化 (`src/serializer/module-writer.ts`)
  - JS_WriteModule 实现
  - req_module_entries 序列化
  - export_entries 序列化
  - star_export_entries 序列化
  - import_entries 序列化
  - **标注 C 源码**: `@source bytecode.cpp` 中的 JS_WriteModule

- [x] 6a.5 实现值序列化 (`src/serializer/value-writer.ts`)
  - JS_WriteObjectRec: 递归值序列化
  - BC_TAG_* 标签处理
  - JS_WriteString: 字符串序列化
  - JS_WriteBigInt: BigInt 序列化
  - JS_WriteArray: 数组序列化
  - JS_WriteObjectTag: 对象序列化
  - object_list 循环引用处理（allow_reference）
  - **标注 C 源码**: `@source bytecode.cpp` 中的 JS_WriteObjectRec

- [x] 6a.6 实现字节码反序列化 (`src/serializer/bytecode-reader.ts`)
  - BCReaderState 状态管理
  - bc_get_u8, bc_get_u16, bc_get_u32, bc_get_u64
  - bc_get_leb128, bc_get_sleb128
  - bc_get_atom: 读取 atom 引用
  - **标注 C 源码**: `@source bytecode.cpp` 中的 bc_get_* 函数

- [x] 6a.7 实现值反序列化 (`src/serializer/value-reader.ts`)
  - JS_ReadObjectRec: 递归值反序列化
  - BC_TAG_* 标签解码
  - JS_ReadString/JS_ReadBigInt
  - JS_ReadArray/JS_ReadObjectTag
  - **标注 C 源码**: `@source bytecode.cpp` 中的 JS_ReadObjectRec

- [x] 6a.8 实现模块反序列化 (`src/serializer/module-reader.ts`)
  - JS_ReadModule 实现
  - req_module_entries/export_entries/import_entries 反序列化
  - **标注 C 源码**: `@source bytecode.cpp` 中的 JS_ReadModule

- [x] 6a.9 实现函数字节码反序列化 (`src/serializer/function-reader.ts`)
  - JS_ReadFunctionTag 实现
  - 函数头解码
  - vardefs, closure_var 反序列化
  - 字节码和调试信息反序列化
  - **标注 C 源码**: `@source bytecode.cpp` 中的 JS_ReadFunctionTag

- [x] 6a.10 序列化模块单元测试
  - 写入/读取往返测试
  - 格式正确性验证
  - 与 QuickJS 格式完全对比

## 7. 编译器集成

- [x] 7.1 实现编译器入口 (`src/compiler.ts`)
  - compile 函数
  - 编译选项处理（严格模式、模块模式等）
  - strip_debug/strip_source 选项支持
  - 错误收集和报告
  - **标注 C 源码**: 对应 __JS_EvalInternal

- [x] 7.2 实现 js_create_function (`src/compiler/create-function.ts`)
  - js_create_function 主函数
  - 编译 Pass 1: 解析和发射
  - 编译 Pass 2: resolve_variables
  - 编译 Pass 3: resolve_labels
  - 子函数递归编译
  - JSFunctionBytecode 创建
  - **标注 C 源码**: `@source parser.c` 中的 js_create_function

- [x] 7.3 实现命令行接口 (`src/cli.ts`)
  - 文件编译命令
  - 输出选项（.qjsc 格式）
  - 调试选项（DUMP_BYTECODE）
  - strip 选项

- [x] 7.4 更新 package.json
  - 添加编译脚本
  - 添加测试脚本
  - 添加 typescript 依赖

## 7a. 模块编译模块

- [x] 7a.1 实现模块解析 (`src/module/module-parser.ts`)
  - js_parse_import 实现
  - js_parse_export 实现
  - js_parse_source_element（模块顶层元素）
  - import.meta 解析与绑定
  - import attributes 解析与存储
  - **标注 C 源码**: `@source parser.c` 中的 js_parse_import/export

- [x] 7a.2 实现模块变量处理 (`src/module/module-variables.ts`)
  - add_module_variables
  - 模块闭包变量添加
  - 导出变量解析
  - **标注 C 源码**: `@source parser.c` 中的 add_module_variables

- [x] 7a.3 实现导入/导出条目 (`src/module/module-entries.ts`)
  - JSImportEntry 结构
  - JSExportEntry 结构
  - JSReqModuleEntry 结构
  - JSStarExportEntry 结构
  - import_name 为 '*' 的 is_star 标志
  - add_export_entry2 函数
  - **标注 C 源码**: `@source parser.c` 中的 add_export_entry2

- [x] 7a.4 实现模块检测 (`src/module/module-detect.ts`)
  - JS_DetectModule 实现
  - 自动检测 import/export 语句
  - **标注 C 源码**: `@source parser.c` 中的 JS_DetectModule

- [x] 7a.5 模块编译单元测试
  - 导入语句编译测试
  - 导出语句编译测试
  - 模块变量解析测试

## 8. QuickJS WASM 源码调试支持

- [x] 8.1 更新 buildWasm.ts 添加 DWARF 调试支持
  - 添加 `-g` 编译标志支持
  - 添加 `--debug-dwarf` 命令行选项
  - Debug 构建默认启用调试信息

- [x] 8.2 实现分离调试信息
  - 添加 `--separate-dwarf` 选项
  - 生成 `.debug.wasm` 文件
  - 配置 `SEPARATE_DWARF_URL` 指向本地文件

- [x] 8.3 更新 CMakeLists.txt
  - 添加 DWARF 相关编译选项
  - 支持 Debug/Release 不同配置
  - 处理 `-fno-inline` 优化标志

- [x] 8.4 Chrome DevTools 集成验证
  - 验证源码断点功能
  - 验证变量查看功能
  - 验证调用栈追踪
  - 文档化调试流程

## 9. 字节码运行支持

- [x] 9.1 实现字节码运行接口 (`src/runtime/runner.ts`)
  - 加载 QuickJS WASM 模块
  - 执行编译后的字节码
  - 返回执行结果
  - 释放字节码 atom（free_bytecode_atoms 对齐）

- [x] 9.2 实现字节码对比验证 (`src/runtime/comparator.ts`)
  - 比较 TS 编译器生成的字节码与 QuickJS WASM 编译器
  - **按字节完全对比**，非功能等价
  - 生成详细的差异报告（不匹配字节位置、十六进制对比）

- [x] 9.2a 实现运行时验证 (`src/runtime/execution-validator.ts`)
  - 使用 QuickJS WASM 运行时执行 TS 编译器生成的字节码
  - 对比 TS 字节码和 QuickJS 字节码的执行结果
  - 验证返回值、异常和副作用是否一致

- [x] 9.3 更新 scripts/QuickJSLib.ts
  - 添加字节码编译 API
  - 添加字节码执行 API
  - 添加字节码序列化/反序列化

- [x] 9.4 字节码运行单元测试
  - 简单表达式运行验证
  - 函数调用运行验证
  - 错误处理验证
  - **TS 字节码 vs QuickJS 字节码执行结果对比**

## 10. 字节码对齐验证框架

- [x] 10.1 实现自动化对齐测试 (`src/test/alignment-test.ts`)
  - 遍历所有 fixtures 目录
  - 对每个 fixture 同时使用 TS 编译器和 QuickJS WASM 编译
  - 按字节对比两者输出的字节码
  - **运行两者生成的字节码并对比执行结果**

- [x] 10.2 实现差异报告生成器 (`src/test/diff-reporter.ts`)
  - 生成可读的字节码差异报告
  - 显示不匹配的字节位置和上下文
  - 支持 JSON 和文本格式输出

- [x] 10.3 实现 CI/CD 集成
  - 每次提交自动运行对齐测试
  - 任何字节码不匹配则构建失败
  - 生成测试覆盖率报告

- [x] 10.4 实现回归测试机制
  - 保存已通过的 fixture 字节码快照
  - 检测新修改是否破坏已有功能
  - 支持批量更新快照（当 QuickJS 版本升级时）

## 11. 测试和验证

- [x] 11.1 单元测试完善
  - 各模块测试覆盖率 > 80%
  - 边界情况覆盖

- [x] 11.2 Fixtures 集成测试
  - 编译 fixtures/basic/ 所有文件
  - 编译 fixtures/es2020/ 所有文件
  - 验证编译成功率

- [x] 11.3 QuickJS WASM 字节码对齐测试
  - 运行自动化对齐测试框架
  - 所有 fixtures 必须完全对齐
  - 生成对齐测试报告
  - **执行结果验证报告**（TS 字节码运行结果 vs QuickJS 字节码运行结果）

- [x] 11.4 性能测试
  - 编译时间基准
  - 内存使用监控
  - 大文件测试

## 12. 文档和清理

- [x] 12.1 API 文档
  - 编译器 API 文档
  - 类型定义文档
  - 使用示例

- [x] 12.2 WASM 调试文档
  - Chrome DevTools 调试指南
  - DWARF 调试信息说明
  - 常见问题解答

- [x] 12.3 字节码对齐验证文档
  - 验证机制说明
  - 如何添加新 fixture
  - 故障排除指南

- [x] 12.4 架构文档
  - 模块关系图
  - 数据流图
  - 扩展指南

- [x] 12.5 代码清理
  - 删除调试代码
  - 统一代码风格
  - 添加必要注释
