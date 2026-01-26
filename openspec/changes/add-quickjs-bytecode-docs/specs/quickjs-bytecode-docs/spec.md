# 能力：QuickJS 字节码文档与 ES2020 夹具

## ADDED Requirements

### Requirement: Opcode 目录覆盖
系统应提供完整的 QuickJS 字节码 opcode 目录，包括每个 opcode 的用途、操作数、栈效果与副作用。

#### Scenario: 读者查询 opcode 细节
- **WHEN** 读者查找某个 opcode
- **THEN** 文档提供其含义、操作数与栈行为

### Requirement: 字节码生成流程文档
系统应文档化从解析到发射的完整字节码生成流程，并引用涉及的 QuickJS 函数。

#### Scenario: 从语法追踪到发射
- **WHEN** 读者选择某个语法形式
- **THEN** 文档展示解析路径、codegen 入口与发射函数

### Requirement: ES2020 全语法生成全流程
系统应提供覆盖 ES2020 全部语法的字节码生成全流程说明，清晰描述从解析、AST 构建到字节码发射的端到端链路。

#### Scenario: 查看全流程说明
- **WHEN** 读者查看 ES2020 全语法流程
- **THEN** 文档包含分阶段流程与对应函数级路径

### Requirement: ES2020 语法到字节码映射
系统应将所有 ES2020 语法形式映射到发射的字节码序列与对应的 QuickJS codegen 函数。

#### Scenario: 验证语法覆盖
- **WHEN** 评审检查某个 ES2020 语法项
- **THEN** 文档包含最小示例及对应的发射 opcode

### Requirement: ES2020 夹具覆盖
系统应在 fixtures/es2020 下提供覆盖所有 ES2020 语法形式的夹具，并与文档示例一致。

#### Scenario: 执行夹具验证覆盖
- **WHEN** 使用 QuickJS 工具链执行夹具
- **THEN** 每个 ES2020 语法类别至少有一个夹具

### Requirement: 源码版本可追溯
系统应明确标注用于文档的 QuickJS 源码版本/分支。

#### Scenario: 验证版本对齐
- **WHEN** 读者查看文档版本说明
- **THEN** 能清晰看到 QuickJS fork 与引用 commit
