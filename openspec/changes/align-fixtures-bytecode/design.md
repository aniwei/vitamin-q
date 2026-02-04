## Context
需要实现全量 fixtures（basic/es2020/quickjs）与 QuickJS WASM 输出字节码的完全对齐，包括模块编译模式与临时 opcode 解析/优化阶段。

## Goals / Non-Goals
- Goals:
  - 全量 fixtures 与 QuickJS WASM 字节码一致（逐指令对齐）。
  - 支持模块语义（import.meta / dynamic import）按 QuickJS 方式编译。
  - 统一临时 opcode 与短指令转换逻辑，消除编码差异。
- Non-Goals:
  - 新增非 ES2020 语法特性。
  - 改写 QuickJS WASM 侧实现。

## Decisions
- Decision: 引入完整的编译阶段对齐（resolve_labels/resolve_variables 等临时 opcode 归约）并与 QuickJS 规则一致。
  - Alternatives considered: 仅在对比脚本中做 normalize（被拒绝，无法保证运行时一致性）。
- Decision: fixture 比对以 QuickJS WASM 为唯一真值来源。
  - Alternatives considered: 维护独立“期望字节码”快照（被拒绝，维护成本高）。

## Risks / Trade-offs
- 大量差异集中于模块模式、类/私有字段、可选链等复杂语法，可能带来长尾修复。
- 将临时 opcode 与短指令转换引入编译流程可能影响现有测试，需要补充回归覆盖。

## Migration Plan
1) 统一编译阶段输出（临时 opcode 解析 + 短指令选择）。
2) 修复语法/语义差异（类/私有字段/可选链/解构/异常控制流）。
3) 模块编译模式对齐并覆盖 import.meta/dynamic import。
4) 全量 fixtures 对比并达成 0 diff。

## Open Questions
- QuickJS WASM 侧是否需要固定编译选项（优化/调试开关）以避免字节码漂移？
