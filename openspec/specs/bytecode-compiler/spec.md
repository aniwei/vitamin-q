# bytecode-compiler Specification

## Purpose
TBD - created by archiving change implement-bytecode-compiler. Update Purpose after archive.
## Requirements
### Requirement: TypeScript 字节码编译器核心

编译器系统 SHALL 提供一个完整的 TypeScript 实现，将 TypeScript/JavaScript 源码编译为 QuickJS 兼容的字节码。实现应参照 QuickJS C 源码流程，并在代码中标注对应的 C 源码位置。

#### Scenario: 编译简单表达式
- **WHEN** 用户提供包含表达式 `1 + 2 * 3` 的 JavaScript 源码
- **THEN** 编译器生成包含 `push_1`, `push_2`, `push_3`, `mul`, `add` 操作码序列的字节码

#### Scenario: 编译函数定义
- **WHEN** 用户提供包含函数定义的 JavaScript 源码
- **THEN** 编译器生成正确的函数字节码，包括参数处理和返回值

#### Scenario: 编译类定义
- **WHEN** 用户提供包含类定义（含构造函数、方法、字段）的 JavaScript 源码
- **THEN** 编译器生成正确的类构建字节码

#### Scenario: 编译 TypeScript 源码
- **WHEN** 用户提供包含类型注解的 TypeScript 源码
- **THEN** 编译器忽略类型注解并生成正确的字节码

---

### Requirement: C 源码对照实现

编译器实现 SHALL 参照 QuickJS C 源码流程，结合 docs 文档进行开发，并在代码中标注对应的 C 源码位置信息。

#### Scenario: 标注 C 源码位置
- **WHEN** 实现 TypeScript 编译器的任何函数
- **THEN** 在函数的 JSDoc 注释中使用 `@source quickjs.c:LINE` 或 `@source quickjs.c:START-END` 标注对应的 C 源码位置
- **AND** 使用 `@see FUNCTION_NAME` 标注对应的 C 函数名

#### Scenario: 遵循 C 源码流程
- **WHEN** 实现编译相关逻辑（发射器、解析器、优化器）
- **THEN** 实现逻辑应尽可能遵循 QuickJS C 源码中对应函数的处理流程
- **AND** 保持与 C 实现一致的处理顺序和逻辑结构

#### Scenario: 结合 docs 文档
- **WHEN** 实现任何编译器模块
- **THEN** 应同时参考 `docs/quickjs/` 目录下的文档和 QuickJS C 源码
- **AND** 文档用于理解概念，C 源码用于确保实现细节正确

#### Scenario: 便于调试对照
- **WHEN** 字节码对比验证失败
- **THEN** 开发者可以通过代码中的 C 源码标注快速定位到对应的 C 实现
- **AND** 对比 TypeScript 实现和 C 实现的差异

---

### Requirement: 类结构和命名规范

编译器实现 SHALL 采用完全对应 QuickJS C 结构体的类/接口定义，使用 TypeScript 驼峰风格命名。

#### Scenario: 字段完全对应
- **WHEN** 定义 TypeScript 类或接口（如 JSFunctionDef）
- **THEN** 字段应完全对应 QuickJS C 结构体中的字段
- **AND** 不遗漏任何 C 结构体字段

#### Scenario: 驼峰风格命名
- **WHEN** 将 C 结构体字段转换为 TypeScript
- **THEN** 使用驼峰风格命名（`var_count` → `varCount`，`arg_count` → `argCount`）
- **AND** 保持语义一致性

#### Scenario: 字段映射注释
- **WHEN** 定义 TypeScript 接口字段
- **THEN** 应在注释中标注对应的 C 字段名
- **AND** 便于对照 C 源码调试

---

### Requirement: 枚举/常量自动生成

编译器 SHALL 通过调用 QuickJS WASM (scripts/getEnv.ts) 自动生成操作码枚举和常量定义，确保与 QuickJS WASM 完全对齐。

#### Scenario: 从 QuickJS WASM 导出操作码
- **WHEN** 运行 `scripts/getEnv.ts` 脚本
- **THEN** 从 QuickJS WASM 运行时获取所有操作码定义
- **AND** 生成 `src/types/opcodes.generated.ts` 文件

#### Scenario: 从 QuickJS WASM 导出常量
- **WHEN** 运行 `scripts/getEnv.ts` 脚本
- **THEN** 从 QuickJS WASM 运行时获取原子常量、标志常量等
- **AND** 生成 `src/types/constants.generated.ts` 文件

#### Scenario: 生成文件标记
- **WHEN** 生成 TypeScript 枚举/常量文件
- **THEN** 文件包含 `@generated` 标记
- **AND** 注释说明不要手动修改

#### Scenario: 枚举值对齐验证
- **WHEN** 运行枚举对齐测试
- **THEN** 验证每个 Opcode 枚举值与 QuickJS WASM 运行时返回的值完全一致
- **AND** 任何不一致都导致测试失败

#### Scenario: 常量值对齐验证
- **WHEN** 运行常量对齐测试
- **THEN** 验证每个常量值与 QuickJS WASM 运行时返回的值完全一致
- **AND** 任何不一致都导致测试失败

#### Scenario: 自动化更新
- **WHEN** QuickJS 版本升级
- **THEN** 重新运行 `scripts/getEnv.ts` 即可同步更新所有枚举和常量
- **AND** 对齐测试验证更新后的值仍然正确

---

### Requirement: 宏环境模拟

编译器 SHALL 使用 `process.env` 环境变量模拟 C 语言的条件编译宏，支持运行时调试控制。

#### Scenario: DEBUG 模式
- **WHEN** 设置 `process.env.DEBUG=true`
- **THEN** 启用调试模式，执行额外的验证逻辑
- **AND** 对应 C 中的 `#ifdef DEBUG`

#### Scenario: DUMP_BYTECODE 输出
- **WHEN** 设置 `process.env.DUMP_BYTECODE=true`
- **THEN** 在编译过程中输出字节码详细信息
- **AND** 对应 C 中的 `#ifdef DUMP_BYTECODE`

#### Scenario: DUMP_ATOMS 输出
- **WHEN** 设置 `process.env.DUMP_ATOMS=true`
- **THEN** 在编译过程中输出原子表信息
- **AND** 对应 C 中的 `#ifdef DUMP_ATOMS`

#### Scenario: 多种调试开关
- **WHEN** 需要不同的调试输出
- **THEN** 支持 `DUMP_CLOSURE`、`DUMP_SOURCE`、`DUMP_READ_OBJECT`、`DUMP_MEM` 等开关
- **AND** 每个开关对应 C 中相应的宏定义

#### Scenario: 生产环境禁用
- **WHEN** 未设置任何调试环境变量
- **THEN** 所有调试输出被禁用
- **AND** 不影响正常编译功能

---

### Requirement: 语句调度模块 (AST Visitor)

编译器 SHALL 提供语句调度模块，遍历 TypeScript AST 并根据节点类型分发到对应的处理器。

#### Scenario: 解析 JavaScript 源码
- **WHEN** 输入纯 JavaScript 源码
- **THEN** 使用 `ts.createSourceFile` 解析为 TypeScript AST

#### Scenario: 解析 TypeScript 源码
- **WHEN** 输入包含类型注解的 TypeScript 源码
- **THEN** 正确解析并在遍历时忽略类型节点

#### Scenario: 遍历 AST 节点
- **WHEN** 需要遍历源码 AST
- **THEN** 提供基于 `ts.forEachChild` 的遍历器，支持自定义访问器

#### Scenario: 语句调度
- **WHEN** 遍历到不同类型的 AST 节点
- **THEN** 调度器根据节点类型分发到对应的处理器
- **AND** 支持表达式、语句、声明等不同类型的调度

#### Scenario: 获取源码位置
- **WHEN** 需要获取 AST 节点的源码位置
- **THEN** 提供 ts.Node 位置到 line:column 的转换工具

---

### Requirement: 字节码发射器 (Phase 1)

编译器 SHALL 提供字节码发射器，将 AST 转换为包含临时操作码的初始字节码序列。

#### Scenario: 发射值压栈操作码
- **WHEN** 遇到字面量表达式
- **THEN** 发射器生成对应的 push 操作码（push_i32, push_const 等）

#### Scenario: 发射运算操作码
- **WHEN** 遇到二元运算表达式
- **THEN** 发射器生成对应的运算操作码（add, sub, mul, div 等）

#### Scenario: 发射控制流操作码
- **WHEN** 遇到 if/for/while 等控制流语句
- **THEN** 发射器生成跳转操作码（goto, if_false 等）和标签

#### Scenario: 发射作用域临时操作码
- **WHEN** 遇到变量声明和访问
- **THEN** 发射器生成作用域相关临时操作码（scope_get_var, scope_put_var, enter_scope 等）

#### Scenario: 管理常量池
- **WHEN** 遇到字符串、大数字、正则表达式等常量
- **THEN** 发射器将常量添加到常量池并生成 push_const 操作码

---

### Requirement: 变量模块 (Phase 2)

编译器 SHALL 提供变量模块实现作用域管理、变量解析和闭包分析功能。

#### Scenario: 作用域管理
- **WHEN** 进入新的代码块（函数、循环、条件等）
- **THEN** 变量模块执行 push_scope 创建新作用域
- **AND** 退出时执行 pop_scope 销毁作用域

#### Scenario: 解析局部变量
- **WHEN** 变量在当前函数作用域中定义
- **THEN** 解析器将 `scope_get_var` 转换为 `get_loc`，`scope_put_var` 转换为 `put_loc`

#### Scenario: 解析函数参数
- **WHEN** 变量是函数参数
- **THEN** 解析器将 `scope_get_var` 转换为 `get_arg`，`scope_put_var` 转换为 `put_arg`

#### Scenario: 解析闭包变量
- **WHEN** 变量在外层函数作用域中定义
- **THEN** 解析器将 `scope_get_var` 转换为 `get_var_ref`，并记录闭包捕获
- **AND** 闭包分析器执行 add_closure_var

#### Scenario: 解析全局变量
- **WHEN** 变量未在任何本地作用域定义
- **THEN** 解析器将 `scope_get_var` 转换为 `get_var`（全局查找）

---

### Requirement: 标签模块 (Phase 3)

编译器 SHALL 提供标签模块实现标签管理和跳转偏移计算功能。

#### Scenario: 标签管理
- **WHEN** 遇到控制流语句（if、for、while、switch 等）
- **THEN** 标签模块执行 new_label 创建标签
- **AND** 执行 emit_label 发射标签位置
- **AND** 执行 emit_goto 发射跳转指令

#### Scenario: 计算跳转偏移
- **WHEN** 字节码包含 goto 和标签指令
- **THEN** 解析器计算所有跳转的正确字节偏移

#### Scenario: 移除临时操作码
- **WHEN** 字节码包含 enter_scope、leave_scope 等临时操作码
- **THEN** 解析器将这些操作码移除或替换

---

### Requirement: 字节码优化模块

编译器 SHALL 提供字节码优化模块实现窥孔优化、短操作码转换和死代码消除。

#### Scenario: 窥孔优化
- **WHEN** 字节码包含可优化的指令序列
- **THEN** 优化器应用窥孔优化（如冗余 push/pop 消除）

#### Scenario: 短操作码转换
- **WHEN** 操作数在特定范围内
- **THEN** 优化器将长操作码转换为短操作码
- **AND** `push_i32 0` → `push_0`
- **AND** `get_loc N` → `get_loc0`/`get_loc1`/`get_loc2`/`get_loc3`（N < 4）

#### Scenario: 死代码消除
- **WHEN** 存在不可达代码
- **THEN** 优化器移除这些死代码

---

### Requirement: 调试信息模块

编译器 SHALL 提供调试信息模块实现 PC 到行号映射和源码映射功能。

#### Scenario: PC 到行号映射 (pc2line)
- **WHEN** 需要从字节码位置定位到源码行号
- **THEN** 调试模块提供 debug_pc2line 功能
- **AND** 生成压缩的行号表格式

#### Scenario: 源码映射生成
- **WHEN** 启用调试模式编译
- **THEN** 调试模块生成源码位置映射
- **AND** 包含变量名、函数名信息

#### Scenario: 调试信息序列化
- **WHEN** 输出字节码时包含调试信息
- **THEN** 调试模块将调试信息序列化为 QuickJS 兼容格式

---

### Requirement: 序列化模块

编译器 SHALL 提供序列化模块实现字节码输出功能。

#### Scenario: 字节码序列化
- **WHEN** 编译完成后需要输出字节码
- **THEN** 序列化模块生成 QuickJS .qjsc 格式的字节码文件

#### Scenario: 函数字节码序列化
- **WHEN** 序列化单个函数
- **THEN** 输出包含函数头、字节码序列、常量池、闭包变量信息

#### Scenario: 模块字节码序列化
- **WHEN** 序列化 ES 模块
- **THEN** 输出包含模块元数据、导入/导出信息、模块依赖

---

### Requirement: 字节码输出

编译器 SHALL 提供字节码序列化功能，生成 QuickJS 兼容的字节码格式。

#### Scenario: 生成函数字节码
- **WHEN** 编译完成一个函数
- **THEN** 输出包含操作码序列、常量池、变量信息的完整函数字节码

#### Scenario: 生成调试信息
- **WHEN** 启用调试模式编译
- **THEN** 输出包含源码位置映射的调试信息

#### Scenario: 生成模块字节码
- **WHEN** 编译 ES 模块
- **THEN** 输出包含导入/导出元数据的模块字节码

---

### Requirement: 错误处理

编译器 SHALL 提供完善的错误处理机制。

#### Scenario: 词法错误报告
- **WHEN** 源码包含无效的 Token（如未闭合的字符串）
- **THEN** 编译器报告错误位置和错误类型

#### Scenario: 语法错误报告
- **WHEN** 源码包含语法错误（如缺少括号）
- **THEN** 编译器报告错误位置和期望的语法元素

#### Scenario: 语义错误报告
- **WHEN** 源码包含语义错误（如重复声明变量）
- **THEN** 编译器报告错误位置和错误原因

#### Scenario: 多错误收集
- **WHEN** 源码包含多个错误
- **THEN** 编译器收集并报告所有错误，而非遇到第一个错误就停止

---

### Requirement: 操作码类型系统

编译器 SHALL 定义完整的操作码类型系统，包含所有 254 个 QuickJS 操作码。

#### Scenario: 运行时操作码定义
- **WHEN** 编译器需要发射运行时操作码
- **THEN** 所有运行时操作码（push_i32, add, get_loc 等）均有定义和元数据

#### Scenario: 临时操作码定义
- **WHEN** 编译器需要发射临时操作码
- **THEN** 所有临时操作码（scope_get_var, enter_scope 等）均有定义和元数据

#### Scenario: 操作码元数据
- **WHEN** 访问任意操作码信息
- **THEN** 可获取操作码大小、栈弹出数、栈压入数、操作数格式

---

### Requirement: ES2020 完整支持

编译器 SHALL 支持编译所有 ES2020 JavaScript 语法特性。

#### Scenario: 编译可选链操作符
- **WHEN** 源码包含 `a?.b?.c` 表达式
- **THEN** 编译器生成正确的短路求值字节码

#### Scenario: 编译空值合并操作符
- **WHEN** 源码包含 `a ?? b` 表达式
- **THEN** 编译器生成正确的 null/undefined 检查字节码

#### Scenario: 编译私有类字段
- **WHEN** 源码包含类私有字段 `#field`
- **THEN** 编译器生成正确的私有字段访问字节码

#### Scenario: 编译动态导入
- **WHEN** 源码包含 `import()` 表达式
- **THEN** 编译器生成 OP_import 操作码

#### Scenario: 编译 async/await
- **WHEN** 源码包含异步函数和 await 表达式
- **THEN** 编译器生成正确的异步函数字节码

---

### Requirement: TypeScript 源码支持

编译器 SHALL 支持直接编译 TypeScript 源码，自动忽略类型注解。

#### Scenario: 忽略类型注解
- **WHEN** 源码包含变量类型注解 `let x: number = 1`
- **THEN** 编译器忽略 `: number` 并正确生成字节码

#### Scenario: 忽略接口和类型定义
- **WHEN** 源码包含 `interface` 或 `type` 声明
- **THEN** 编译器忽略这些声明，不生成任何字节码

#### Scenario: 处理 TypeScript 特有语法
- **WHEN** 源码包含枚举、参数属性等 TypeScript 特有语法
- **THEN** 编译器将其转换为等价的 JavaScript 语义

---

### Requirement: QuickJS WASM 源码调试支持

构建系统 SHALL 支持将 QuickJS 编译为包含 DWARF 调试信息的 WASM，可在 Chrome DevTools 中进行 C/C++ 源码级调试。

#### Scenario: Debug 构建包含调试信息
- **WHEN** 使用 `--debug` 或 `--debug-dwarf` 选项构建 WASM
- **THEN** 生成的 WASM 文件包含完整的 DWARF 调试信息
- **AND** 可在 Chrome DevTools 中查看 C/C++ 源码

#### Scenario: 分离调试信息
- **WHEN** 使用 `--separate-dwarf` 选项构建 WASM
- **THEN** 生成主 WASM 文件和独立的 `.debug.wasm` 文件
- **AND** 主 WASM 文件体积显著减小

#### Scenario: Chrome DevTools 源码级断点
- **WHEN** 在 Chrome DevTools 中打开包含调试信息的 WASM
- **THEN** 可以在 QuickJS C 源码中设置断点
- **AND** 断点触发时显示 C 变量的原始名称和值

#### Scenario: 调用栈追踪
- **WHEN** WASM 执行暂停（断点或异常）
- **THEN** DevTools 显示完整的 C 函数调用栈
- **AND** 可以点击调用栈跳转到对应源码位置

---

### Requirement: 字节码生成

编译器 SHALL 生成与 QuickJS 兼容的字节码文件。

#### Scenario: 生成字节码文件
- **WHEN** 编译 TypeScript/JavaScript 源码
- **THEN** 生成 `.qjsc` 格式的字节码文件
- **AND** 字节码可被 QuickJS 运行时加载执行

#### Scenario: 字节码序列化
- **WHEN** 编译完成后请求输出字节码
- **THEN** 返回包含函数字节码、常量池、调试信息的完整序列化数据

#### Scenario: 字节码完全对齐
- **WHEN** 同一源码分别使用 TS 编译器和 QuickJS WASM 编译器编译
- **THEN** 两者生成的字节码必须按字节完全一致
- **AND** 任何字节差异都视为 TS 编译器的错误

---

### Requirement: 字节码运行

系统 SHALL 支持通过 QuickJS WASM 运行时执行编译生成的字节码，并对比执行结果。

#### Scenario: 加载并执行字节码
- **WHEN** 将编译生成的字节码传递给 QuickJS WASM 运行时
- **THEN** 运行时成功加载并执行字节码
- **AND** 返回正确的执行结果

#### Scenario: 运行 TS 编译器生成的字节码
- **WHEN** TypeScript 编译器生成字节码
- **THEN** QuickJS WASM 运行时可以加载并执行该字节码
- **AND** 执行结果与 QuickJS WASM 编译器生成的字节码执行结果一致

#### Scenario: 运行时错误处理
- **WHEN** 字节码执行过程中发生错误
- **THEN** 运行时捕获错误并返回错误信息
- **AND** 错误信息包含源码位置（如有调试信息）

#### Scenario: 执行结果对比验证
- **WHEN** 需要验证编译器正确性
- **THEN** 分别运行 TS 编译器和 QuickJS WASM 编译器生成的字节码
- **AND** 对比两者的执行结果（返回值、异常、副作用）
- **AND** 两者执行结果必须完全一致

#### Scenario: 双重验证机制
- **WHEN** 运行完整的验证测试
- **THEN** 同时执行字节码对齐验证（按字节对比）
- **AND** 执行结果验证（运行结果对比）
- **AND** 两项验证都必须通过才视为测试通过

---

### Requirement: 字节码对齐验证机制

系统 SHALL 提供自动化的字节码对齐验证机制，确保 TypeScript 编译器每次迭代都与 QuickJS WASM 编译器输出完全一致。

#### Scenario: 自动化对齐测试
- **WHEN** 运行对齐测试命令
- **THEN** 自动遍历所有 fixtures 目录中的测试用例
- **AND** 对每个用例同时使用 TS 编译器和 QuickJS WASM 编译器编译
- **AND** 按字节对比两者输出的字节码

#### Scenario: 对齐测试通过
- **WHEN** TS 编译器和 QuickJS WASM 编译器对同一源码生成完全相同的字节码
- **THEN** 该测试用例标记为通过
- **AND** 记录通过状态

#### Scenario: 对齐测试失败
- **WHEN** TS 编译器和 QuickJS WASM 编译器对同一源码生成不同的字节码
- **THEN** 该测试用例标记为失败
- **AND** 生成详细的字节码差异报告
- **AND** 报告包含不匹配的字节位置、十六进制对比、操作码解析

#### Scenario: CI/CD 集成
- **WHEN** 提交代码到仓库
- **THEN** CI/CD 流水线自动运行对齐测试
- **AND** 任何对齐测试失败都导致构建失败
- **AND** 生成测试报告供开发者查看

#### Scenario: 回归测试保护
- **WHEN** 修改 TS 编译器代码
- **THEN** 对齐测试验证修改没有破坏已有功能
- **AND** 所有之前通过的测试用例仍然通过

