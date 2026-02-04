## 1. Implementation
- [x] 1.1 建立全量 fixtures 对比基线（basic/es2020/quickjs），记录当前差异分布
- [ ] 1.2 对齐临时 opcode 解析与短指令选择逻辑（resolve_variables/resolve_labels 及短指令）
- [ ] 1.3 修复表达式差异（可选链、空值合并、模板、运算符与字面量编码）
- [ ] 1.4 修复语句与控制流差异（try/catch/finally、复杂循环、可选 catch 绑定）
- [ ] 1.5 修复类/私有字段/方法定义差异（computed property、home object、private fields）
- [ ] 1.6 修复解构与正则相关差异（复杂对象/数组解构、regexp advanced）
- [ ] 1.7 模块编译模式对齐（import.meta/dynamic import/modules fixtures）
- [ ] 1.8 修复残余差异并完成全量 0 diff
- [ ] 1.9 每类差异对齐后补充相关函数单元测试（含 QuickJS WASM 对应函数）
- [ ] 1.10 建立 fixture 分段定位流程与工具化支持（按段编译/对比字节码）

## 2. Validation
- [ ] 2.1 运行 compareFixtures 全量对比，输出 0 diff
- [ ] 2.2 运行现有 emitter 单测确保不回归
- [ ] 2.3 运行新增单元测试（含 WASM 对应函数）验证覆盖
