# Vitamin-Q 架构

## 模块关系

- AST 层：解析与遍历
  - 解析：`src/ast/parser.ts`
  - 访问器：`src/ast/visitor.ts`

- 编译层：编译入口与函数创建
  - 编译入口：`src/compiler.ts`
  - 函数创建：`src/compiler/create-function.ts`

- 发射层：字节码生成
  - 核心发射器：`src/emitter/emitter.ts`
  - 语句/表达式：`src/emitter/statements.ts` / `src/emitter/expressions.ts`

- 变量/控制流/标签/优化：
  - 变量：`src/variable/*`
  - 控制流：`src/control-flow/*`
  - 标签：`src/label/*`
  - 优化：`src/optimizer/*`

- 调试/序列化/运行：
  - 调试：`src/debug/*`
  - 序列化：`src/serializer/*`
  - 运行：`src/runtime/*`

## 数据流

1. Source → TypeScript AST
2. AST → BytecodeEmitter 生成临时字节码
3. resolve_labels → 去除临时 opcode
4. 优化阶段（窥孔/短操作码/死代码）
5. 生成 JSFunctionBytecode 视图
6. 可选：与 QuickJS WASM 对齐/运行验证

## 扩展指南

- 新语法支持：在 `src/emitter/expressions.ts` / `src/emitter/statements.ts` 增加处理分支。
- 新操作码：通过 `scripts/getEnv.ts` 从 WASM 生成并更新 `src/env.ts`。
