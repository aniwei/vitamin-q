# Change: Align fixture bytecode with QuickJS WASM

## Why
当前全量 fixtures 与 QuickJS WASM 字节码不一致，影响编译器可信度与回归验证。

## What Changes
- 建立全量 fixtures 与 QuickJS WASM 的字节码对齐目标（basic/es2020/quickjs）。
- 完成编译阶段与运行时字节码差异的修复与一致性验证。
- 明确模块模式（import.meta / dynamic import）在对齐流程中的编译策略。

## Impact
- Affected specs: quickjs-bytecode-internals
- Affected code: src/emitter/**, src/label/**, scripts/compareWithWasm.ts, scripts/QuickJSLib.ts, fixtures/**

## Current Status (2026-02-03)
- Baseline compare established for basic/es2020/quickjs.
- Label resolution and operand copying aligned with QuickJS semantics.
- Short opcode selection expanded (push_i32, loc/arg, call, const/fclosure, var_ref).
- Comparison pipeline stabilized (0 invalid/unknown opcode diffs).
- Remaining fixture diffs: 70/152 failing (0 invalid/unknown).
