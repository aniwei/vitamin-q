# 字节码对齐验证

## 目的

对比 TypeScript 编译器与 QuickJS WASM 编译器生成的字节码，并校验运行结果一致。

## 使用

```bash
pnpm run test:alignment
```

### 可选环境变量

- `ALIGNMENT_MAX`: 限制对齐测试的文件数量
- `ALIGNMENT_UPDATE=1`: 更新回归快照
- `ALIGNMENT_SNAPSHOT=1`: 校验回归快照

## 新增 fixture

1. 将用例放入 `fixtures/basic` 或 `fixtures/es2020`。
2. 运行 `pnpm run test:alignment` 验证对齐。

## 故障排除

- 若出现 diff，查看控制台报告中的字节位置与上下文。
- 若运行结果不一致，检查运行时输出差异。
