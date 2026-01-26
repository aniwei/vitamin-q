# QuickJS 字节码文档与 ES2020 夹具

本目录包含 QuickJS 字节码生成逻辑的完整文档和 ES2020 语法夹具。

## 📚 文档

- **[bytecode.md](bytecode.md)** - QuickJS 字节码生成完整文档
  - 所有 opcode 的语义与栈效果（99.6% 覆盖率，253/254 个）
  - 字节码生成全流程（函数级引用）
  - ES2020 语法到字节码的映射（29 个语法类别）
  - 与夹具文件一一对应

- **[VERIFICATION.md](VERIFICATION.md)** - 验证报告
  - Opcode 覆盖率验证（99.6%）
  - ES2020 语法特性验证（100% 覆盖核心语法）
  - 夹具文件验证（19/19 通过）
  - 验证步骤与工具说明

## 📂 相关目录

- **[fixtures/es2020/](../../fixtures/es2020/)** - ES2020 语法夹具（19 个文件）
  - `async/` - async/await、for-await-of
  - `classes/` - class、extends、super、static
  - `expressions/` - 字面量、运算符、可选链、空值合并、模板字符串等
  - `functions/` - 函数、箭头函数、默认参数、rest 参数
  - `generators/` - 生成器函数、yield
  - `modules/` - import/export、dynamic import、import.meta
  - `patterns/` - 解构赋值
  - `statements/` - 控制流、try-catch-finally
  - `misc/` - with、debugger

## 🛠️ 验证工具

- **[scripts/verifyFixtures.ts](../../scripts/verifyFixtures.ts)** - 夹具验证脚本
- **[scripts/verifyDocumentation.ts](../../scripts/verifyDocumentation.ts)** - 文档验证脚本

### 运行验证

```bash
# 验证夹具文件（19 个文件）
npx tsx scripts/verifyFixtures.ts

# 验证文档完整性（opcode 覆盖率、ES2020 特性覆盖）
npx tsx scripts/verifyDocumentation.ts
```

## ✅ 验证状态

| 验证项 | 状态 | 覆盖率 |
|--------|------|--------|
| Opcode 文档覆盖 | ✅ | 99.6% (253/254) |
| ES2020 语法覆盖 | ✅ | 100% (核心语法) |
| 文档结构完整性 | ✅ | 100% |
| 夹具文件验证 | ✅ | 100% (19/19) |

## 🎯 使用场景

1. **理解 QuickJS 字节码生成逻辑**
   - 查看 [bytecode.md](bytecode.md) 的 opcode 目录
   - 了解解析到发射的完整流程

2. **学习 ES2020 语法的字节码映射**
   - 查看 [bytecode.md](bytecode.md) 第 5 节
   - 对照 [fixtures/es2020/](../../fixtures/es2020/) 中的示例

3. **开发 QuickJS 工具**
   - 参考 opcode 语义与栈效果表
   - 使用夹具文件进行测试

4. **调试字节码生成问题**
   - 查找对应语法的解析函数与 opcode
   - 使用夹具文件重现问题

## 📖 源码引用

文档基于以下 QuickJS 源码：
- `third_party/QuickJS/include/QuickJS/quickjs-opcode.h` - opcode 定义
- `third_party/QuickJS/src/core/parser.c` - 解析与字节码发射
- `third_party/QuickJS/src/core/function.c` - 字节码执行
- `third_party/QuickJS/src/core/bytecode.cpp` - 字节码对象

## 🔗 相关链接

- QuickJS 官方仓库：https://github.com/bellard/quickjs
- ES2020 规范：https://262.ecma-international.org/11.0/
- 任务清单：[openspec/changes/add-quickjs-bytecode-docs/tasks.md](../../openspec/changes/add-quickjs-bytecode-docs/tasks.md)
