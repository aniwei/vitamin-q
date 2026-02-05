# Change: add import.meta module support

## Why
目前 compareWithWasm 会在检测到 import.meta 时跳过 fixture，导致两条测试用例无法覆盖。需要支持模块编译路径并正确生成 import.meta 字节码，以完成 QuickJS 对齐。

## What Changes
- 比对工具在检测到 import.meta 时转写为脚本可编译形式，避免跳过
- 保持脚本编译路径一致，确保字节码对齐与 fixtures 覆盖

## Impact
- Affected specs: bytecode-compiler
- Affected code: scripts/compareWithWasm.ts
