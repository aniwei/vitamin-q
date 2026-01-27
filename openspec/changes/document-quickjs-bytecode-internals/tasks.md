# Tasks: Document QuickJS Bytecode Internals

## 1. 源码分析准备

- [ ] 1.1 记录分析的 QuickJS commit hash
- [ ] 1.2 整理核心源文件列表与行数统计
- [ ] 1.3 生成函数调用关系概览

## 2. 架构文档 (architecture.md)

- [ ] 2.1 绘制 QuickJS 整体架构图
- [ ] 2.2 梳理核心模块依赖关系
- [ ] 2.3 描述编译-执行数据流
- [ ] 2.4 记录关键数据结构（JSContext, JSRuntime, JSFunctionDef 等）

## 3. 解析器文档 (parser-internals.md)

- [ ] 3.1 分析词法分析器 `next_token` 实现
- [ ] 3.2 梳理 token 类型与处理逻辑
- [ ] 3.3 解析表达式解析函数族（`js_parse_expr*`）
- [ ] 3.4 解析语句解析函数族（`js_parse_statement*`）
- [ ] 3.5 解析函数/类解析（`js_parse_function_decl2`, `js_parse_class`）
- [ ] 3.6 解析模板字面量解析（`js_parse_template`）
- [ ] 3.7 建立解析函数调用链图

## 4. 字节码发射文档 (bytecode-emission.md)

- [ ] 4.1 分析 `emit_op` 系列函数
- [ ] 4.2 解析操作数格式（FMT_* 宏）
- [ ] 4.3 梳理常量池（cpool）管理逻辑
- [ ] 4.4 解析标签系统（`new_label`, `emit_label`, `emit_goto`）
- [ ] 4.5 分析 IC（Inline Cache）发射机制
- [ ] 4.6 建立发射函数与 opcode 映射表

## 5. 作用域解析文档 (scope-resolution.md)

- [ ] 5.1 深度分析 `resolve_variables` 函数（~500 行）
- [ ] 5.2 解析 `resolve_labels` 实现
- [ ] 5.3 梳理变量查找算法（`find_var*`, `find_arg`）
- [ ] 5.4 解析闭包变量捕获（`add_closure_var`）
- [ ] 5.5 分析作用域链实现（`push_scope`, `pop_scope`）
- [ ] 5.6 解析全局变量处理（`find_global_var`, `add_global_var`）

## 6. 字节码优化文档 (bytecode-optimization.md)

- [ ] 6.1 分析窥孔优化（peephole optimization）
- [ ] 6.2 解析死代码消除逻辑
- [ ] 6.3 梳理常量折叠实现
- [ ] 6.4 分析标签合并与跳转优化
- [ ] 6.5 解析 `get_prev_opcode` 优化辅助

## 7. 字节码执行文档 (bytecode-execution.md)

- [ ] 7.1 深度分析 `JS_CallInternal`（~2000 行）
- [ ] 7.2 解析操作码分派机制
- [ ] 7.3 梳理栈帧管理逻辑
- [ ] 7.4 分析调用约定（calling convention）
- [ ] 7.5 解析异常处理机制（try/catch/finally）
- [ ] 7.6 分析生成器（generator）执行逻辑
- [ ] 7.7 分析异步函数（async/await）执行逻辑

## 8. 模块系统文档 (module-system.md)

- [ ] 8.1 分析模块解析（`js_parse_module`）
- [ ] 8.2 解析导入处理（import statements）
- [ ] 8.3 解析导出处理（export statements）
- [ ] 8.4 分析 `js_execute_sync_module`
- [ ] 8.5 分析 `js_execute_async_module`
- [ ] 8.6 解析循环依赖处理机制

## 9. 内置对象文档 (builtins.md)

- [ ] 9.1 整理 24 个内置模块列表
- [ ] 9.2 分析原生函数绑定机制（`JS_CFUNC_DEF`）
- [ ] 9.3 解析类型系统与值表示（`JSValue`）
- [ ] 9.4 选取典型模块深入分析（Array, Promise, Generator）
- [ ] 9.5 分析 BigInt 实现

## 10. Opcode 参考文档 (opcode-reference.md)

- [ ] 10.1 解析 `quickjs-opcode.h` 完整定义
- [ ] 10.2 分类整理 254 个操作码
- [ ] 10.3 为每个 opcode 记录栈效果
- [ ] 10.4 为每个 opcode 记录操作数格式
- [ ] 10.5 添加典型用法示例

## 11. 临时字节码与运行时字节码分类 (opcode-categories.md)

- [ ] 11.1 区分 DEF 宏（运行时字节码）与 def 宏（临时字节码）
- [ ] 11.2 梳理每个运行时字节码的作用
  - [ ] 11.2.1 值压栈类（push_i32, push_const, undefined, null 等）
  - [ ] 11.2.2 栈操作类（drop, dup, swap, rot, nip 等）
  - [ ] 11.2.3 函数调用类（call, call_method, call_constructor, return 等）
  - [ ] 11.2.4 变量访问类（get_loc, put_loc, get_var, put_var, get_var_ref 等）
  - [ ] 11.2.5 属性访问类（get_field, put_field, get_array_el, put_array_el 等）
  - [ ] 11.2.6 控制流类（if_false, if_true, goto, catch, gosub, ret 等）
  - [ ] 11.2.7 算术运算类（add, sub, mul, div, mod, neg, inc, dec 等）
  - [ ] 11.2.8 位运算与比较类（shl, sar, lt, eq, strict_eq, and, or 等）
  - [ ] 11.2.9 迭代器类（for_in_start, for_of_next, iterator_next 等）
  - [ ] 11.2.10 异步类（await, yield, initial_yield, return_async 等）
  - [ ] 11.2.11 短操作码优化类（push_0-7, get_loc0-3, call0-3 等）
  - [ ] 11.2.12 类与对象定义类（define_class, define_method, set_proto 等）
- [ ] 11.3 梳理每个临时字节码的作用
  - [ ] 11.3.1 作用域标记（enter_scope, leave_scope）
  - [ ] 11.3.2 标签占位（label）
  - [ ] 11.3.3 作用域变量访问（scope_get_var*, scope_put_var* 系列）
  - [ ] 11.3.4 私有字段访问（scope_*_private_field 系列）
  - [ ] 11.3.5 可选链处理（get_field_opt_chain, get_array_el_opt_chain）
  - [ ] 11.3.6 类名设置（set_class_name）
  - [ ] 11.3.7 调试信息（line_num）
- [ ] 11.4 文档化临时字节码在哪个编译阶段被移除/转换

## 12. 字节码宏生成机制文档 (opcode-macro-system.md)

- [ ] 12.1 分析 DEF/def 宏定义结构
  - [ ] 12.1.1 解析 `DEF(id, size, n_pop, n_push, f)` 参数含义
  - [ ] 12.1.2 解析 `def(...)` 小写宏与 DEF 的差异
  - [ ] 12.1.3 解析 `FMT(...)` 操作数格式宏
- [ ] 12.2 分析编译时宏展开机制
  - [ ] 12.2.1 多次 `#include "quickjs-opcode.h"` 技术
  - [ ] 12.2.2 通过重定义 DEF 宏生成不同代码
  - [ ] 12.2.3 `opcode_info[]` 数组生成过程
  - [ ] 12.2.4 `enum OPCodeEnum { OP_xxx }` 枚举生成过程
  - [ ] 12.2.5 `OP_COUNT` 与 `OP_TEMP_START` 常量生成
- [ ] 12.3 分析运行时分派表生成
  - [ ] 12.3.1 `dispatch_table[256]` 跳转表生成
  - [ ] 12.3.2 `CASE(OP_xxx)` / `case_OP_xxx` 标签生成
  - [ ] 12.3.3 直接线程化（Direct Threading）实现
  - [ ] 12.3.4 调试模式下的 `debugger_dispatch_table` 生成
  - [ ] 12.3.5 `SHORT_OPCODES` 条件编译对生成的影响
- [ ] 12.4 绘制宏展开流程图
  - [ ] 12.4.1 编译期：opcode.h → enum + info array
  - [ ] 12.4.2 运行期：switch/goto 分派

## 13. 完整语法到字节码映射 (syntax-to-bytecode/)

### 13.1 表达式类 (expressions.md)
- [ ] 13.1.1 字面量（数字/字符串/布尔/null/undefined）+ 流程图 + JS示例
- [ ] 13.1.2 标识符访问 + 流程图 + JS示例
- [ ] 13.1.3 属性访问（obj.prop / obj[expr]）+ 流程图 + JS示例
- [ ] 13.1.4 二元算术运算符 + 流程图 + JS示例
- [ ] 13.1.5 一元运算符 + 流程图 + JS示例
- [ ] 13.1.6 比较运算符 + 流程图 + JS示例
- [ ] 13.1.7 逻辑运算符（&&, ||, ??）+ 流程图 + JS示例
- [ ] 13.1.8 赋值运算符 + 流程图 + JS示例
- [ ] 13.1.9 递增递减（前缀/后缀）+ 流程图 + JS示例
- [ ] 13.1.10 三元运算符 + 流程图 + JS示例
- [ ] 13.1.11 函数调用 / 方法调用 + 流程图 + JS示例
- [ ] 13.1.12 new 表达式 + 流程图 + JS示例
- [ ] 13.1.13 数组字面量 + 流程图 + JS示例
- [ ] 13.1.14 对象字面量 + 流程图 + JS示例
- [ ] 13.1.15 模板字符串 + 流程图 + JS示例
- [ ] 13.1.16 扩展运算符 + 流程图 + JS示例
- [ ] 13.1.17 可选链（?.）+ 流程图 + JS示例

### 13.2 语句类 (statements.md)
- [ ] 13.2.1 变量声明（var/let/const）+ 流程图 + JS示例
- [ ] 13.2.2 块语句 / 空语句 + 流程图 + JS示例
- [ ] 13.2.3 if/else 条件语句 + 流程图 + JS示例
- [ ] 13.2.4 switch 语句 + 流程图 + JS示例
- [ ] 13.2.5 for/while/do-while 循环 + 流程图 + JS示例
- [ ] 13.2.6 for-in / for-of 迭代 + 流程图 + JS示例
- [ ] 13.2.7 break / continue / return + 流程图 + JS示例
- [ ] 13.2.8 throw / try-catch-finally + 流程图 + JS示例
- [ ] 13.2.9 with / label / debugger + 流程图 + JS示例

### 13.3 函数类 (functions.md)
- [ ] 13.3.1 函数声明 / 函数表达式 + 流程图 + JS示例
- [ ] 13.3.2 箭头函数 + 流程图 + JS示例
- [ ] 13.3.3 参数默认值 / 剩余参数 + 流程图 + JS示例
- [ ] 13.3.4 解构参数 + 流程图 + JS示例
- [ ] 13.3.5 Generator 函数 + 流程图 + JS示例
- [ ] 13.3.6 Async 函数 + 流程图 + JS示例
- [ ] 13.3.7 Async Generator + 流程图 + JS示例

### 13.4 类与对象类 (classes.md)
- [ ] 13.4.1 class 声明 / class 表达式 + 流程图 + JS示例
- [ ] 13.4.2 constructor + 流程图 + JS示例
- [ ] 13.4.3 实例方法 / 静态方法 + 流程图 + JS示例
- [ ] 13.4.4 getter / setter + 流程图 + JS示例
- [ ] 13.4.5 实例字段 / 静态字段 + 流程图 + JS示例
- [ ] 13.4.6 私有字段 / 私有方法 + 流程图 + JS示例
- [ ] 13.4.7 类继承 / super + 流程图 + JS示例
- [ ] 13.4.8 静态初始化块 + 流程图 + JS示例

### 13.5 模块类 (modules.md)
- [ ] 13.5.1 import 声明（default/named/namespace）+ 流程图 + JS示例
- [ ] 13.5.2 export 声明 + 流程图 + JS示例
- [ ] 13.5.3 动态 import() + 流程图 + JS示例

### 13.6 解构类 (destructuring.md)
- [ ] 13.6.1 数组解构 + 流程图 + JS示例
- [ ] 13.6.2 对象解构 + 流程图 + JS示例
- [ ] 13.6.3 嵌套解构 + 流程图 + JS示例
- [ ] 13.6.4 默认值 / 剩余模式 + 流程图 + JS示例

## 14. ES2020 完整覆盖示例 (es2020-complete-example.md)

### 14.1 设计完整示例代码
- [ ] 14.1.1 设计包含所有 ES2020 特性的单一 JS 文件（~100-150 行）
- [ ] 14.1.2 确保代码可实际执行
- [ ] 14.1.3 添加注释标注每个 ES2020 特性

### 14.2 绘制整体编译流程图
- [ ] 14.2.1 入口点：模块解析流程
- [ ] 14.2.2 第一遍：解析 + Phase 1 字节码发射
- [ ] 14.2.3 第二遍：resolve_variables（作用域解析）
- [ ] 14.2.4 第三遍：resolve_labels（标签解析 + 优化）
- [ ] 14.2.5 最终：字节码序列化

### 14.3 分段字节码解析
- [ ] 14.3.1 可选链（?.）+ 空值合并（??）字节码分析 + 流程图
- [ ] 14.3.2 BigInt 操作字节码分析 + 流程图
- [ ] 14.3.3 动态 import() 字节码分析 + 流程图
- [ ] 14.3.4 类私有字段/方法字节码分析 + 流程图
- [ ] 14.3.5 类静态字段/方法/静态块字节码分析 + 流程图
- [ ] 14.3.6 逻辑赋值（??=, ||=, &&=）字节码分析 + 流程图
- [ ] 14.3.7 可选 catch 绑定字节码分析 + 流程图
- [ ] 14.3.8 for-in 迭代字节码分析 + 流程图

### 14.4 关键解析节点详细流程
- [ ] 14.4.1 绘制 js_parse_unary（处理可选链）详细流程图
- [ ] 14.4.2 绘制 js_parse_class（处理私有字段）详细流程图
- [ ] 14.4.3 绘制 js_parse_import（处理动态导入）详细流程图
- [ ] 14.4.4 绘制 resolve_variables（处理私有字段解析）详细流程图

### 14.5 字节码执行流程
- [ ] 14.5.1 示例代码的运行时执行路径
- [ ] 14.5.2 关键 opcode 的 JS_CallInternal 处理
- [ ] 14.5.3 私有字段访问的运行时检查

## 15. 字节码生成函数完整分析 (bytecode-functions/)

### 15.1 解析函数分析 (parsing-functions.md)
- [ ] 15.1.1 `next_token` (L689) 实现逻辑 + 流程图
- [ ] 15.1.2 `js_parse_expr` (L6331) 实现逻辑 + 流程图
- [ ] 15.1.3 `js_parse_assign_expr` (L6303) 实现逻辑 + 流程图
- [ ] 15.1.4 `js_parse_cond_expr` (L5976) 实现逻辑 + 流程图
- [ ] 15.1.5 `js_parse_coalesce_expr` (L5947) 实现逻辑 + 流程图
- [ ] 15.1.6 `js_parse_unary` (L5606) 实现逻辑 + 流程图
- [ ] 15.1.7 `js_parse_postfix_expr` (L4840) 实现逻辑 + 流程图
- [ ] 15.1.8 `js_parse_left_hand_side_expr` (L3057) 实现逻辑 + 流程图
- [ ] 15.1.9 `js_parse_statement_or_decl` (L6941) 实现逻辑 + 流程图
- [ ] 15.1.10 `js_parse_statement` (L6513) 实现逻辑 + 流程图
- [ ] 15.1.11 `js_parse_block` (L6517) 实现逻辑 + 流程图
- [ ] 15.1.12 `js_parse_function_decl2` (L12979) 实现逻辑 + 流程图
- [ ] 15.1.13 `js_parse_class` (L3230) 实现逻辑 + 流程图
- [ ] 15.1.14 `js_parse_import` (L8076) 实现逻辑 + 流程图
- [ ] 15.1.15 `js_parse_export` (L7861) 实现逻辑 + 流程图
- [ ] 15.1.16 `js_parse_template` (L2453) 实现逻辑 + 流程图
- [ ] 15.1.17 `js_parse_object_literal` (L2928) 实现逻辑 + 流程图
- [ ] 15.1.18 `js_parse_array_literal` (L3760) 实现逻辑 + 流程图
- [ ] 15.1.19 `js_parse_destructuring_element` (L4296) 实现逻辑 + 流程图
- [ ] 15.1.20 `js_parse_delete` (L5517) 实现逻辑 + 流程图

### 15.2 字节码发射函数分析 (emit-functions.md)
- [ ] 15.2.1 `emit_op` (L1796) 实现逻辑 + 流程图
- [ ] 15.2.2 `emit_u8/u16/u32` (L1768-1778) 实现逻辑 + 流程图
- [ ] 15.2.3 `emit_atom` (L1805) 实现逻辑 + 流程图
- [ ] 15.2.4 `emit_ic` (L1814) 实现逻辑 + 流程图
- [ ] 15.2.5 `emit_label` (L1866) 实现逻辑 + 流程图
- [ ] 15.2.6 `emit_goto` (L1878) 实现逻辑 + 流程图
- [ ] 15.2.7 `emit_source_pos` (L1783) 实现逻辑 + 流程图
- [ ] 15.2.8 `emit_return` (L6407) 实现逻辑 + 流程图
- [ ] 15.2.9 `emit_break` (L6360) 实现逻辑 + 流程图
- [ ] 15.2.10 `emit_class_field_init` (L3144) 实现逻辑 + 流程图
- [ ] 15.2.11 `emit_class_init_start/end` (L3181/3216) 实现逻辑 + 流程图
- [ ] 15.2.12 `js_emit_spread_code` (L4207) 实现逻辑 + 流程图
- [ ] 15.2.13 `get_lvalue` (L3906) 实现逻辑 + 流程图
- [ ] 15.2.14 `put_lvalue` (L4044) 实现逻辑 + 流程图
- [ ] 15.2.15 `optional_chain_test` (L4821) 实现逻辑 + 流程图

### 15.3 作用域与变量函数分析 (scope-functions.md)
- [ ] 15.3.1 `push_scope` (L2038) 实现逻辑 + 流程图
- [ ] 15.3.2 `pop_scope` (L2089) 实现逻辑 + 流程图
- [ ] 15.3.3 `close_scopes` (L2104) 实现逻辑 + 流程图
- [ ] 15.3.4 `add_var` (L2113) 实现逻辑 + 流程图
- [ ] 15.3.5 `add_scope_var` (L2135) 实现逻辑 + 流程图
- [ ] 15.3.6 `add_func_var` (L2152) 实现逻辑 + 流程图
- [ ] 15.3.7 `add_arg` (L2195) 实现逻辑 + 流程图
- [ ] 15.3.8 `define_var` (L2249) 实现逻辑 + 流程图
- [ ] 15.3.9 `find_var*` 系列 (L1935-1999) 实现逻辑 + 流程图
- [ ] 15.3.10 `find_lexical_decl` (L2017) 实现逻辑 + 流程图
- [ ] 15.3.11 `add_closure_var` 实现逻辑 + 流程图

### 15.4 标签系统函数分析 (label-functions.md)
- [ ] 15.4.1 `new_label` (L1849) 实现逻辑 + 流程图
- [ ] 15.4.2 `new_label_fd` (L1828) 实现逻辑 + 流程图
- [ ] 15.4.3 `update_label` (L1818) 实现逻辑 + 流程图
- [ ] 15.4.4 `push_break_entry` (L2419) 实现逻辑 + 流程图
- [ ] 15.4.5 `pop_break_entry` (L2426) 实现逻辑 + 流程图

### 15.5 常量池函数分析 (cpool-functions.md)
- [ ] 15.5.1 `cpool_add` (L1894) 实现逻辑 + 流程图

### 15.6 变量解析函数深度分析 (resolve-functions.md)
- [ ] 15.6.1 `resolve_variables` (L10495) 完整分析
  - [ ] 15.6.1.1 函数结构概览 + 分段说明
  - [ ] 15.6.1.2 完整实现流程图（Mermaid）
  - [ ] 15.6.1.3 scope_get_var* 处理逻辑 + 流程图
  - [ ] 15.6.1.4 scope_put_var* 处理逻辑 + 流程图
  - [ ] 15.6.1.5 scope_*_private_field 处理逻辑 + 流程图
  - [ ] 15.6.1.6 闭包变量捕获流程图
  - [ ] 15.6.1.7 关键分支行号标注
- [ ] 15.6.2 `resolve_labels` (L11139) 完整分析
  - [ ] 15.6.2.1 函数结构概览 + 分段说明
  - [ ] 15.6.2.2 完整实现流程图（Mermaid）
  - [ ] 15.6.2.3 标签到偏移转换逻辑 + 流程图
  - [ ] 15.6.2.4 窥孔优化实现 + 流程图
  - [ ] 15.6.2.5 短操作码转换逻辑 + 流程图
  - [ ] 15.6.2.6 关键分支行号标注

### 15.7 函数调用关系图 (function-call-graph.md)
- [ ] 15.7.1 主解析入口调用图
- [ ] 15.7.2 表达式解析调用链
- [ ] 15.7.3 语句解析调用链
- [ ] 15.7.4 字节码发射调用链
- [ ] 15.7.5 变量解析调用链
- [ ] 15.7.6 完整编译流程调用图

## 16. ES2020 完整语法 Fixtures 补全 (fixtures/es2020/)

### 16.1 类相关 Fixtures (classes/)
- [ ] 16.1.1 `class-basic.ts`: 基本类声明
- [ ] 16.1.2 `class-inheritance.ts`: 类继承 + super
- [ ] 16.1.3 `class-private-fields.ts`: 私有字段 #field
- [ ] 16.1.4 `class-private-methods.ts`: 私有方法 #method()
- [ ] 16.1.5 `class-static-fields.ts`: 静态字段
- [ ] 16.1.6 `class-static-methods.ts`: 静态方法
- [ ] 16.1.7 `class-static-block.ts`: 静态初始化块
- [ ] 16.1.8 `class-accessors.ts`: getter/setter
- [ ] 16.1.9 `class-computed-names.ts`: 计算属性名

### 16.2 生成器 Fixtures (generators/)
- [ ] 16.2.1 `generator-basic.ts`: 基本生成器
- [ ] 16.2.2 `generator-yield.ts`: yield 表达式
- [ ] 16.2.3 `generator-yield-star.ts`: yield*
- [ ] 16.2.4 `generator-return.ts`: 生成器 return
- [ ] 16.2.5 `async-generator.ts`: 异步生成器

### 16.3 字面量 Fixtures (literals/)
- [ ] 16.3.1 `bigint.ts`: BigInt 字面量
- [ ] 16.3.2 `numeric-separators.ts`: 数字分隔符 1_000_000

### 16.4 ES2020 特有语法 Fixtures (es2020-specific/)
- [ ] 16.4.1 `optional-catch-binding.ts`: 可选 catch 绑定
- [ ] 16.4.2 `logical-assignment.ts`: ??=, ||=, &&=
- [ ] 16.4.3 `dynamic-import.ts`: import()
- [ ] 16.4.4 `import-meta.ts`: import.meta
- [ ] 16.4.5 `export-star-as.ts`: export * as ns
- [ ] 16.4.6 `for-in-order.ts`: for-in 顺序保证
- [ ] 16.4.7 `promise-allsettled.ts`: Promise.allSettled
- [ ] 16.4.8 `globalthis.ts`: globalThis
- [ ] 16.4.9 `string-matchall.ts`: String.prototype.matchAll

### 16.5 补充现有 Fixtures
- [ ] 16.5.1 扩展 `expressions/optional-chaining.ts`: 添加更多边界情况
- [ ] 16.5.2 扩展 `expressions/nullish-coalescing.ts`: 添加与 ?. 组合使用
- [ ] 16.5.3 扩展 `async/async-await.ts`: 添加 for-await-of
- [ ] 16.5.4 扩展 `patterns/destructuring.ts`: 添加更多嵌套情况

### 16.6 Fixtures 验证
- [ ] 16.6.1 确保所有 fixtures 可被 QuickJS 编译
- [ ] 16.6.2 确保每个 fixture 覆盖单一语法点
- [ ] 16.6.3 添加 fixtures 索引文件 README.md

## 17. 导航与索引 (README.md)

- [ ] 17.1 创建文档导航页
- [ ] 17.2 添加快速入门指南
- [ ] 17.3 建立关键概念索引
- [ ] 17.4 添加源码文件速查表

## 18. 验证与完善

- [ ] 18.1 交叉验证文档准确性
- [ ] 18.2 补充代码引用行号
- [ ] 18.3 添加图表（如有必要）
- [ ] 18.4 编写最终审查报告

## Dependencies

- 任务 2 依赖 1（需要先准备源码分析环境）
- 任务 3-9 可并行执行
- 任务 10-12 依赖 3-6（需要理解使用场景）
- 任务 13 依赖 3, 4（需要理解解析和发射逻辑）
- 任务 14 依赖 3, 4, 10-13（需要完整语法理解）
- 任务 15 依赖 3-6（需要理解函数实现）
- 任务 16 可独立执行（fixtures 代码）
- 任务 17-18 依赖所有前置任务
