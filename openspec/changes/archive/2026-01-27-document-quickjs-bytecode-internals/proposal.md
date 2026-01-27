# Change: Document QuickJS Bytecode Generation Internals

## Why

Vitamin-Q 项目需要将 TypeScript 编译为 QuickJS 字节码。当前缺乏对 QuickJS 内部实现的系统性文档，开发者难以理解 `parser.c`（13,783 行）、`function.c`（3,330 行）、`bytecode.cpp`（2,068 行）等核心源码的工作原理。全面梳理 QuickJS 字节码生成逻辑，将帮助开发团队准确实现 TypeScript 到字节码的编译器。

## What Changes

### 文档新增

1. **源码架构文档** (`docs/quickjs/architecture.md`)
   - QuickJS 整体架构概览
   - 核心模块依赖关系图
   - 数据流与控制流分析

2. **解析器深度文档** (`docs/quickjs/parser-internals.md`)
   - 词法分析器（Lexer）完整实现
   - 语法分析器（Parser）递归下降算法
   - 45+ `js_parse_*` 函数逐一解析
   - AST 到字节码的直接翻译模式

3. **字节码发射器文档** (`docs/quickjs/bytecode-emission.md`)
   - 20+ `emit_*` 函数详解
   - 操作数编码格式（FMT_*）
   - 常量池（cpool）管理
   - 标签（label）系统与跳转指令

4. **变量与作用域解析文档** (`docs/quickjs/scope-resolution.md`)
   - `resolve_variables` 完整流程
   - `resolve_labels` 实现细节
   - 闭包变量捕获机制
   - 作用域链与变量查找算法

5. **字节码优化文档** (`docs/quickjs/bytecode-optimization.md`)
   - 窥孔优化（Peephole Optimization）
   - 死代码消除
   - 常量折叠
   - 标签合并与跳转优化

6. **运行时执行文档** (`docs/quickjs/bytecode-execution.md`)
   - `JS_CallInternal` 主循环解析
   - 操作码分派机制（SWITCH/CASE）
   - 栈帧管理与调用约定
   - 异常处理机制

7. **模块系统文档** (`docs/quickjs/module-system.md`)
   - ES Module 加载流程
   - `js_execute_sync_module` / `js_execute_async_module`
   - 导入导出解析
   - 循环依赖处理

8. **内置对象实现文档** (`docs/quickjs/builtins.md`)
   - 24 个内置模块概览（Array, Promise, Generator 等）
   - 原生函数绑定机制
   - 类型系统与值表示

9. **Opcode 完整参考** (`docs/quickjs/opcode-reference.md`)
   - 254 个操作码完整目录
   - 栈效果（stack effect）表
   - 操作数格式详解
   - 用法示例

10. **临时字节码与运行时字节码详解** (`docs/quickjs/opcode-categories.md`)
    - **运行时字节码（DEF 宏定义）**: 最终执行的字节码
      - 值压栈类（push_i32, push_const, undefined, null 等）
      - 栈操作类（drop, dup, swap, rot 等）
      - 函数调用类（call, call_method, return 等）
      - 变量访问类（get_loc, put_loc, get_var, put_var 等）
      - 属性访问类（get_field, put_field, get_array_el 等）
      - 控制流类（if_false, if_true, goto, catch 等）
      - 算术运算类（add, sub, mul, div, neg 等）
      - 迭代器类（for_in_start, for_of_next, iterator_next 等）
      - 异步类（await, yield, initial_yield 等）
      - 短操作码优化类（push_0-7, get_loc0-3, call0-3 等）
    - **编译器临时字节码（def 小写宏定义）**: Phase 1-2 使用后移除
      - `enter_scope` / `leave_scope`: 作用域标记，Phase 2 移除
      - `label`: 标签占位符，Phase 3 转换为实际偏移
      - `scope_get_var*` / `scope_put_var*`: 作用域变量访问，Phase 2 解析
      - `scope_*_private_field`: 私有字段访问，Phase 2 解析
      - `get_field_opt_chain` / `get_array_el_opt_chain`: 可选链，Phase 2 转换
      - `set_class_name`: 类名设置，Phase 2 处理
      - `line_num`: 行号信息，Phase 3 移除
    - 每个字节码的详细作用说明
    - 编译器 vs 运行时字节码的转换关系

11. **字节码宏生成机制** (`docs/quickjs/opcode-macro-system.md`)
    - **DEF/def 宏系统解析**
      - `DEF(id, size, n_pop, n_push, f)` 宏参数说明
      - `def(...)` 小写宏用于临时字节码
      - `FMT(...)` 操作数格式定义
    - **编译时宏生成**
      - `#include "quickjs-opcode.h"` 多次包含技术
      - 通过重定义 DEF 宏生成不同代码结构
      - `opcode_info[]` 数组生成
      - 操作码枚举 `enum OPCodeEnum` 生成
    - **运行时分派表生成**
      - `dispatch_table[256]` 跳转表生成
      - `CASE(OP_xxx)` 分支生成
      - 直接线程化（Direct Threading）优化
      - `SHORT_OPCODES` 条件编译
    - **宏展开流程图**
      - 编译期：opcode.h → enum + info array
      - 运行期：switch/goto 分派

12. **完整语法到字节码映射** (`docs/quickjs/syntax-to-bytecode/`)
    - **表达式类** (`expressions.md`)
      - 字面量（数字、字符串、布尔、null、undefined）
      - 标识符访问、属性访问、计算属性访问
      - 二元运算符（+, -, *, /, %, **, &, |, ^, <<, >>, >>>）
      - 一元运算符（+, -, !, ~, typeof, void, delete）
      - 比较运算符（==, ===, !=, !==, <, >, <=, >=, in, instanceof）
      - 逻辑运算符（&&, ||, ??）
      - 赋值运算符（=, +=, -=, *=, /=, %=, etc.）
      - 递增递减（++, -- 前缀/后缀）
      - 三元运算符（?:）
      - 函数调用、方法调用、new 表达式
      - 数组字面量、对象字面量
      - 模板字符串
      - 扩展运算符（...）
      - 可选链（?.）
    - **语句类** (`statements.md`)
      - 变量声明（var, let, const）
      - 块语句、空语句、表达式语句
      - if/else 条件语句
      - switch 语句
      - for/while/do-while 循环
      - for-in / for-of 迭代
      - break / continue / return
      - throw / try-catch-finally
      - with 语句
      - label 语句
      - debugger 语句
    - **函数类** (`functions.md`)
      - 函数声明 / 函数表达式
      - 箭头函数
      - 参数默认值、剩余参数
      - 解构参数
      - Generator 函数
      - Async 函数
      - Async Generator
    - **类与对象类** (`classes.md`)
      - class 声明 / class 表达式
      - constructor
      - 实例方法 / 静态方法
      - getter / setter
      - 实例字段 / 静态字段
      - 私有字段 / 私有方法
      - 类继承（extends）
      - super 调用
      - 静态初始化块
    - **模块类** (`modules.md`)
      - import 声明（default, named, namespace）
      - export 声明（default, named, re-export）
      - 动态 import()
    - **解构类** (`destructuring.md`)
      - 数组解构
      - 对象解构
      - 嵌套解构
      - 默认值
      - 剩余模式
    - 每个语法均包含：
      - ✅ **流程图**：解析到字节码生成的完整流程
      - ✅ **JS 示例代码**：典型 JavaScript 输入
      - ✅ **字节码输出**：对应生成的 opcode 序列
      - ✅ **源码引用**：parser.c 中的解析函数位置

13. **ES2020 完整覆盖示例** (`docs/quickjs/es2020-complete-example.md`)
    - 一个完整的 JavaScript 代码示例，覆盖所有 ES2020 语法特性
    - **覆盖的语法特性**：
      - 可选链（`?.`）
      - 空值合并（`??`）
      - BigInt
      - `Promise.allSettled`
      - `globalThis`
      - `String.prototype.matchAll`
      - 动态 `import()`
      - `import.meta`
      - `export * as ns`
      - for-in 顺序保证
      - 可选的 catch 绑定
      - 类私有字段
      - 类私有方法
      - 类静态字段
      - 类静态方法
      - `??=`, `||=`, `&&=` 逻辑赋值
    - **文档结构**：
      - ✅ 完整 JS 源码（~100-150 行，覆盖所有特性）
      - ✅ 整体编译流程图（从入口到最终字节码）
      - ✅ 分段字节码解析（按功能模块拆分）
      - ✅ 关键解析节点的详细流程图
      - ✅ 字节码执行流程说明

14. **字节码生成函数完整分析** (`docs/quickjs/bytecode-functions/`)
    - **解析函数分析** (`parsing-functions.md`)
      - `next_token` (L689): 词法分析入口
      - `js_parse_expr` (L6331): 表达式解析入口
      - `js_parse_assign_expr` (L6303): 赋值表达式
      - `js_parse_cond_expr` (L5976): 条件表达式
      - `js_parse_coalesce_expr` (L5947): 空值合并
      - `js_parse_unary` (L5606): 一元表达式
      - `js_parse_postfix_expr` (L4840): 后缀表达式
      - `js_parse_left_hand_side_expr` (L3057): 左值表达式
      - `js_parse_statement_or_decl` (L6941): 语句解析入口
      - `js_parse_statement` (L6513): 语句解析
      - `js_parse_block` (L6517): 块语句
      - `js_parse_function_decl2` (L12979): 函数声明核心
      - `js_parse_class` (L3230): 类声明
      - `js_parse_import` (L8076): 导入语句
      - `js_parse_export` (L7861): 导出语句
      - 每个函数包含：
        - ✅ 函数签名与行号
        - ✅ 功能说明
        - ✅ 实现逻辑流程图（Mermaid）
        - ✅ 调用关系图
        - ✅ 关键代码路径标注
    - **字节码发射函数分析** (`emit-functions.md`)
      - `emit_op` (L1796): 操作码发射核心
      - `emit_u8` (L1768): 8位操作数
      - `emit_u16` (L1773): 16位操作数
      - `emit_u32` (L1778): 32位操作数
      - `emit_atom` (L1805): 原子发射
      - `emit_ic` (L1814): 内联缓存发射
      - `emit_label` (L1866): 标签发射
      - `emit_goto` (L1878): 跳转发射
      - `emit_source_pos` (L1783): 源码位置
      - `emit_return` (L6407): 返回语句
      - `emit_break` (L6360): 跳出语句
      - `emit_class_field_init` (L3144): 类字段初始化
      - `emit_class_init_start` (L3181): 类初始化开始
      - `emit_class_init_end` (L3216): 类初始化结束
      - `js_emit_spread_code` (L4207): 扩展运算符
      - 每个函数包含：
        - ✅ 函数签名与行号
        - ✅ 发射的操作码类型
        - ✅ 实现逻辑流程图
        - ✅ 使用场景示例
    - **作用域与变量函数分析** (`scope-functions.md`)
      - `push_scope` (L2038): 进入作用域
      - `pop_scope` (L2089): 退出作用域
      - `close_scopes` (L2104): 关闭多个作用域
      - `add_var` (L2113): 添加变量
      - `add_scope_var` (L2135): 添加作用域变量
      - `add_func_var` (L2152): 添加函数变量
      - `add_arg` (L2195): 添加参数
      - `define_var` (L2249): 定义变量
      - `find_var` (L1944): 查找变量
      - `find_arg` (L1935): 查找参数
      - `find_var_in_scope` (L1954): 作用域内查找
      - `find_global_var` (L1999): 查找全局变量
      - `find_lexical_decl` (L2017): 查找词法声明
    - **标签系统函数分析** (`label-functions.md`)
      - `new_label` (L1849): 创建新标签
      - `new_label_fd` (L1828): 为函数创建标签
      - `update_label` (L1818): 更新标签引用
      - `push_break_entry` (L2419): 压入 break 条目
      - `pop_break_entry` (L2426): 弹出 break 条目
    - **常量池函数分析** (`cpool-functions.md`)
      - `cpool_add` (L1894): 添加常量到池
    - **变量解析函数分析** (`resolve-functions.md`)
      - `resolve_variables` (L10495): 变量解析核心（~650行）
        - ✅ 完整实现逻辑流程图
        - ✅ scope_* 临时字节码转换逻辑
        - ✅ 闭包变量捕获机制
        - ✅ 关键分支标注
      - `resolve_labels` (L11139): 标签解析核心（~1400行）
        - ✅ 完整实现逻辑流程图
        - ✅ 标签到偏移转换
        - ✅ 窥孔优化实现
        - ✅ 短操作码转换
        - ✅ 关键分支标注
    - **函数调用关系图** (`function-call-graph.md`)
      - 完整的函数调用关系图（Mermaid）
      - 主解析入口到字节码生成的完整路径

15. **ES2020 完整语法 Fixtures 补全** (`fixtures/es2020/`)
    - **现有目录补全**：
      - `classes/` - 类相关 fixtures（当前为空）
        - `class-basic.ts`: 基本类声明
        - `class-inheritance.ts`: 类继承 + super
        - `class-private-fields.ts`: 私有字段 #field
        - `class-private-methods.ts`: 私有方法 #method()
        - `class-static-fields.ts`: 静态字段
        - `class-static-methods.ts`: 静态方法
        - `class-static-block.ts`: 静态初始化块
        - `class-accessors.ts`: getter/setter
        - `class-computed-names.ts`: 计算属性名
      - `generators/` - 生成器 fixtures（当前为空）
        - `generator-basic.ts`: 基本生成器
        - `generator-yield.ts`: yield 表达式
        - `generator-yield-star.ts`: yield*
        - `generator-return.ts`: 生成器 return
        - `async-generator.ts`: 异步生成器
      - `literals/` - 字面量 fixtures（当前为空）
        - `bigint.ts`: BigInt 字面量
        - `numeric-separators.ts`: 数字分隔符 1_000_000
    - **新增目录**：
      - `es2020-specific/` - ES2020 特有语法
        - `optional-catch-binding.ts`: 可选 catch 绑定
        - `logical-assignment.ts`: ??=, ||=, &&=
        - `dynamic-import.ts`: import()
        - `import-meta.ts`: import.meta
        - `export-star-as.ts`: export * as ns
        - `for-in-order.ts`: for-in 顺序保证
        - `promise-allsettled.ts`: Promise.allSettled
        - `globalthis.ts`: globalThis
        - `string-matchall.ts`: String.prototype.matchAll
    - **补充现有文件**：
      - 扩展 `expressions/optional-chaining.ts`: 添加更多边界情况
      - 扩展 `expressions/nullish-coalescing.ts`: 添加与 ?. 组合使用
      - 扩展 `async/async-await.ts`: 添加 for-await-of
      - 扩展 `patterns/destructuring.ts`: 添加更多嵌套情况
    - 每个 fixture 文件包含：
      - ✅ 清晰的语法特性注释
      - ✅ 单一语法点的纯净示例
      - ✅ 边界情况覆盖

## Impact

- **Affected specs**: 无（新能力）
- **Affected code**: 文档 + fixtures 代码
- **Affected fixtures**: `fixtures/es2020/` 目录补全
- **Source files covered**:
  - `third_party/QuickJS/src/core/parser.c` (13,783 lines)
  - `third_party/QuickJS/src/core/function.c` (3,330 lines)
  - `third_party/QuickJS/src/core/bytecode.cpp` (2,068 lines)
  - `third_party/QuickJS/src/core/module.c` (2,084 lines)
  - `third_party/QuickJS/src/core/runtime.c` (3,770 lines)
  - `third_party/QuickJS/src/core/object.c` (2,592 lines)
  - `third_party/QuickJS/src/core/builtins/*.c` (24 files)
  - `third_party/QuickJS/include/QuickJS/quickjs-opcode.h` (375 lines)
  - `third_party/QuickJS/include/QuickJS/quickjs.h` (1,104 lines)
