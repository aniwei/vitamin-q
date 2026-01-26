# 设计：QuickJS 字节码文档与 ES2020 夹具

## 概览
本变更引入“函数级、语法完备”的 QuickJS 字节码生成文档，以及覆盖 ES2020 的夹具集合。文档必须追踪每个语法节点的解析与编译路径，给出精确 opcode 语义与示例。

## 文档结构
- 字节码概览：指令格式、操作数编码、栈效果、执行模型。
- Opcode 目录：每个 opcode 的用途、操作数、副作用与栈行为。
- 生成流程：parser → AST → codegen 函数 → 字节码发射（包含关键调用链）。
- 语法映射：每个 ES2020 语法形式映射到对应的 codegen 函数与字节码序列（含最小示例）。

## 源码映射策略
- 主要来源：third_party/QuickJS/src/core/parser.c、function.c、bytecode.cpp、bytecode.h 及相关辅助文件。
- 对每个语法：
  1) 确认解析入口与 AST 节点类型。
  2) 确认负责发射的 codegen 入口（函数级）。
  3) 列出发射的 opcode 并记录栈效果。

## 夹具策略
- 在 fixtures/es2020 中按语法分类组织（如 expressions、statements、declarations、modules、classes、async、generators、destructuring 等）。
- 每个夹具应最小且明确，并与文档示例一一对应。
- 维护覆盖清单，将夹具映射到语法类别，确保 ES2020 完整覆盖。

## 验证
- 基于 ES2020 语法清单建立覆盖检查表。
- 对照 bytecode.h/bytecode.cpp 校验 opcode 完整性。
- 确保夹具可在 QuickJS 工具链下编译/运行，并与文档字节码路径一致。

## 风险与缓解
- 风险：较少见语法形式遗漏覆盖。
  - 缓解：使用 ES2020 语法清单逐项追踪到 codegen 函数。
- 风险：QuickJS 源码变更导致文档偏离。
  - 缓解：在文档中注明使用的 fork/commit 版本。
