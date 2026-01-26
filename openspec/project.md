# Project Context

## Purpose

Vitamin-Q 是一个 TypeScript 到 QuickJS 字节码编译器项目。项目的主要目标是将 TypeScript 代码编译为 QuickJS 可执行的字节码，实现高效的 JavaScript 运行时环境。

核心目标：
- 将 TypeScript/JavaScript 代码编译为 QuickJS 字节码
- 提供高性能的 JavaScript 运行时支持
- 支持现代 JavaScript 语言特性
- 集成 QuickJS 引擎（基于 bellard/quickjs 的 fork）

## Tech Stack

### 核心技术
- **TypeScript 5.9.2**: 项目主要开发语言
- **Node.js 20+**: 运行时环境
- **QuickJS**: JavaScript 引擎（third_party/QuickJS）
- **Emscripten**: WebAssembly 编译工具链（third_party/emsdk）

### 构建工具
- **pnpm**: 包管理器
- **tsx**: TypeScript 执行工具
- **CMake**: QuickJS 构建系统

### 开发工具
- **ESLint**: 代码质量检查（配置来自 taro/react）
- **EditorConfig**: 编辑器配置标准化

## Project Conventions

### Code Style

**编辑器配置**（.editorconfig）：
- 缩进：2 空格
- 字符编码：UTF-8
- 行尾：自动插入换行符
- 去除行尾空格（Markdown 除外）

**TypeScript 配置**：
- 编译目标：ES2020
- 模块系统：CommonJS
- 严格模式：启用（strict: true）
- 输出目录：./dist

**命名约定**：
- 文件名：kebab-case（例如：arrow-fn-basic.ts）
- 目录结构：按功能/特性分类（basic/, quickjs/）

**ESLint 规则**：
- 继承 taro/react 配置
- 禁用 React 导入检查（支持新版 JSX 转换）

### Architecture Patterns

**项目结构**：
```
vitamin-q/
├── fixtures/          # 测试用例和示例代码
│   ├── basic/        # 基础 JS/TS 特性测试
│   │   ├── array/    # 数组操作测试
│   │   ├── class/    # 类特性测试
│   │   ├── async/    # 异步操作测试
│   │   └── ...       # 其他语言特性
│   └── quickjs/      # QuickJS 特定测试
├── scripts/          # 构建和工具脚本
│   ├── buildWasm.ts  # WebAssembly 构建脚本
│   ├── getEnv.ts     # 环境配置
│   └── QuickJSLib.ts # QuickJS 库封装
├── third_party/      # 第三方依赖
│   ├── QuickJS/      # QuickJS 引擎源码
│   └── emsdk/        # Emscripten SDK
└── openspec/         # OpenSpec 规范和文档
```

**模块组织**：
- 核心编译器代码将输出到 dist/compiler.js
- 测试用例按 JavaScript 语言特性分类组织
- 第三方依赖独立管理，便于更新和维护

### Testing Strategy

**测试框架**：
- Jest（types 中已配置）

**测试用例组织**：
- `fixtures/basic/`: 基础 JavaScript/TypeScript 特性测试
  - 数组操作、箭头函数、异步、位运算
  - 类、闭包、解构、循环等
- `fixtures/quickjs/`: QuickJS 引擎特定功能测试
  - BigInt、闭包、Promise、Worker 等
  - Octane 基准测试

**测试类型**：
- 单元测试：针对各个语言特性的编译和执行
- 集成测试：完整的编译流程测试
- 性能测试：使用 Octane 等基准测试套件

### Git Workflow

**分支策略**：
- 遵循 OpenSpec 工作流
- 重大变更需要创建提案（openspec/changes/）

**提交约定**：
- 使用 OpenSpec 规范进行变更管理
- 提交信息清晰描述改动内容

## Domain Context

### QuickJS 知识
- QuickJS 是一个轻量级的 JavaScript 引擎
- 支持 ES2020 规范
- 本项目使用的是 bellard/quickjs 的 fork 版本（commit: 458c34d）
- 支持字节码编译和执行

### 编译器领域
- TypeScript AST 转换
- JavaScript 语言特性支持：
  - 类和继承（包括私有字段和访问器）
  - 异步/等待和生成器
  - 解构和扩展运算符
  - 计算属性和闭包
  - 位运算和类型转换

### WebAssembly 集成
- 使用 Emscripten 工具链编译 QuickJS 为 WASM
- 支持 Debug 和 Release 构建模式
- 可配置的 trace 和日志级别

## Important Constraints

### 技术约束
- 必须兼容 QuickJS 引擎的字节码格式
- 编译目标为 ES2020，不支持更新的语言特性
- CommonJS 模块系统（而非 ESM）

### 构建约束
- 需要 Emscripten SDK 进行 WASM 编译
- 构建脚本使用 tsx 执行（TypeScript 直接运行）
- 跨平台支持（macOS/Linux）

### 性能约束
- 目标是高性能的字节码生成
- 支持优化和调试两种构建模式

## External Dependencies

### 核心依赖
- **QuickJS Engine**: third_party/QuickJS
  - Fork from bellard/quickjs (commit: 458c34d)
  - 提供 JavaScript 引擎和字节码执行环境

- **Emscripten SDK**: third_party/emsdk
  - 用于将 QuickJS 编译为 WebAssembly
  - 提供完整的工具链支持

### 开发依赖
- @types/node: Node.js 类型定义
- TypeScript: 编译器和类型检查
- tsx: TypeScript 执行器

### 包管理
- 使用 pnpm 作为包管理器
- pnpm-lock.yaml 锁定依赖版本
