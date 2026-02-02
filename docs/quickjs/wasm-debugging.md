# QuickJS WASM 调试流程

本文件用于记录 QuickJS WASM 在 Chrome DevTools 中的调试流程（DWARF）。

## 构建

1. 编译 Debug 版本并启用 DWARF：

- `npx tsx scripts/buildWasm.ts --debug --debug-dwarf`

2. 需要分离调试信息时：

- `npx tsx scripts/buildWasm.ts --debug --debug-dwarf --separate-dwarf`

3. 如果需要便于断点定位，可禁用内联：

- `npx tsx scripts/buildWasm.ts --debug --debug-dwarf --fno-inline`

## Chrome DevTools

1. 使用 Node 启动需要运行 WASM 的脚本，例如：
   - `node scripts/compareWithWasm.ts fixtures/basic/array/basic.ts`

2. 打开 Chrome DevTools（`chrome://inspect`）并连接到 Node 进程。

3. 在 Sources 面板中定位 WASM 模块与 C/C++ 源码映射。

4. 验证：
   - 断点可命中
   - 变量可以展开
   - 调用栈包含 C/C++ 源文件与行号

## 注意事项

- 如果 SourceMap 未加载，确认 `QJS_SEPARATE_DWARF_URL` 与输出路径一致。
- 若调试信息异常，可先删除 `third_party/QuickJS/wasm/build` 并重建。
