# QuickJS 字节码生成内部机制文档

本文档集详细记录了 QuickJS 引擎的字节码生成逻辑，供 Vitamin-Q 项目开发者参考。

## 分析版本

- **QuickJS 版本**: 2025-04-26
- **Git Commit**: `70e83ae71b637592f2c4ad4171fc9db66782c027`
- **分析日期**: 2026-01-27

## 文档索引

### 核心文档

| 文档 | 说明 |
|------|------|
| [architecture.md](./architecture.md) | QuickJS 整体架构概览 |
| [parser-internals.md](./parser-internals.md) | 解析器内部实现 |
| [bytecode-emission.md](./bytecode-emission.md) | 字节码发射机制 |
| [scope-resolution.md](./scope-resolution.md) | 作用域与变量解析 |
| [bytecode-optimization.md](./bytecode-optimization.md) | 字节码优化 |
| [bytecode-execution.md](./bytecode-execution.md) | 字节码执行 |
| [module-system.md](./module-system.md) | ES 模块系统 |
| [builtins.md](./builtins.md) | 内置对象实现 |

### 参考文档

| 文档 | 说明 |
|------|------|
| [opcode-reference.md](./opcode-reference.md) | 254 个操作码完整参考 |
| [opcode-categories.md](./opcode-categories.md) | 临时/运行时字节码分类 |
| [opcode-macro-system.md](./opcode-macro-system.md) | 字节码宏生成机制 |

### 语法映射

| 文档 | 说明 |
|------|------|
| [syntax-to-bytecode/](./syntax-to-bytecode/) | 完整语法到字节码映射 |
| [es2020-complete-example.md](./es2020-complete-example.md) | ES2020 完整示例 |

### 函数分析

| 文档 | 说明 |
|------|------|
| [bytecode-functions/](./bytecode-functions/) | 字节码生成函数分析 |

## 源码文件速查

| 文件 | 行数 | 主要功能 |
|------|------|---------|
| `src/core/parser.c` | 13,783 | 解析 + 字节码发射 |
| `src/core/function.c` | 3,330 | 字节码执行 |
| `src/core/bytecode.cpp` | 2,068 | 字节码序列化 |
| `src/core/module.c` | 2,084 | 模块系统 |
| `src/core/runtime.c` | 3,770 | 运行时基础设施 |
| `include/QuickJS/quickjs-opcode.h` | 375 | 操作码定义 |

## 编译阶段概览

```
源代码
   │
   ▼
┌─────────────────────────────────────┐
│ Phase 1: 解析 + 初始字节码发射      │
│   - next_token() 词法分析            │
│   - js_parse_* 语法分析              │
│   - emit_* 字节码发射                │
│   - 生成临时字节码 (scope_*, label)  │
└─────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────┐
│ Phase 2: 变量解析 (resolve_variables)│
│   - scope_get_var → get_loc/get_var │
│   - 闭包变量捕获                     │
│   - 私有字段解析                     │
└─────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────┐
│ Phase 3: 标签解析 (resolve_labels)   │
│   - label → 实际偏移                 │
│   - 窥孔优化                         │
│   - 短操作码转换                     │
└─────────────────────────────────────┘
   │
   ▼
最终字节码
```

## 快速入门

1. 了解整体架构：阅读 [architecture.md](./architecture.md)
2. 理解操作码：阅读 [opcode-reference.md](./opcode-reference.md)
3. 学习具体语法编译：查看 [syntax-to-bytecode/](./syntax-to-bytecode/)
4. 深入函数实现：参考 [bytecode-functions/](./bytecode-functions/)
