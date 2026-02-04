## ADDED Requirements
### Requirement: Full Fixture Bytecode Parity
系统 SHALL 保证 fixtures/basic、fixtures/es2020、fixtures/quickjs 的编译字节码与 QuickJS WASM 的字节码完全一致。

#### Scenario: 全量 fixtures 对齐成功
- **WHEN** 运行 compareFixtures 对比 basic/es2020/quickjs
- **THEN** 所有用例应当无差异（0 diff）
- **AND** 结果以 QuickJS WASM 输出为真值来源

#### Scenario: 模块语义对齐
- **WHEN** fixtures 中包含 import.meta 或 dynamic import
- **THEN** 必须使用与 QuickJS 一致的模块编译模式
- **AND** 生成字节码与 QuickJS WASM 完全一致

#### Scenario: 临时 opcode 解析一致性
- **WHEN** 生成中间字节码包含临时 opcode（scope_*/label/line_num 等）
- **THEN** 解析与优化阶段应转换为与 QuickJS 等价的运行时字节码
- **AND** 不影响最终对比结果

### Requirement: Fixture Diff Classification and Safe Fixes
系统 SHALL 对 fixtures 差异进行分类并按分类进行统一修复，且修复 MUST 不引入回归导致已对齐的 fixtures 再次产生差异。

#### Scenario: 分类修复无回归
- **WHEN** 对比结果出现新的差异分类
- **THEN** 必须先归类并按分类执行统一修复
- **AND** 修复后已对齐的 fixtures 仍保持无差异

### Requirement: Add Unit Tests After Alignment
系统 SHALL 在每类差异对齐后补充相关函数单元测试，尤其是与 QuickJS WASM 对应的函数接口测试。

#### Scenario: 对齐后补测
- **WHEN** 任一差异分类完成对齐
- **THEN** 必须新增或更新相应函数级单元测试
- **AND** 覆盖与 QuickJS WASM 对应的函数行为

### Requirement: Fixture Segmentation for Diff Analysis
系统 SHALL 支持对有差异的 fixtures 进行分段，以便定位问题并分析各段代码对应的字节码逻辑。

#### Scenario: 分段定位差异
- **WHEN** 某个 fixture 发生字节码差异
- **THEN** 允许将该 fixture 拆分为多段可独立编译的代码
- **AND** 对每段生成与分析字节码以定位差异来源
