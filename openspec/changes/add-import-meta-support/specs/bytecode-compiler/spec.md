## ADDED Requirements
### Requirement: compareWithWasm 支持 import.meta fixtures
比对工具 SHALL 将包含 `import.meta` 的源码转写为脚本可编译形式，以避免跳过并保证可对齐比较。

#### Scenario: 转写 import.meta
- **WHEN** 输入源码包含 `import.meta`
- **THEN** 比对工具在编译前将 `import.meta` 转写为脚本可编译的占位引用
- **AND** 保持脚本编译路径一致

#### Scenario: 对齐 import.meta fixtures
- **WHEN** 运行 compareWithWasm 全量 fixtures
- **THEN** 含 `import.meta` 的 fixtures 不再被跳过
- **AND** 与 QuickJS wasm 输出一致
