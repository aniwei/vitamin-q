# 编译器 API

## compile

```ts
import { compile } from 'src/compiler'

const result = compile('const a = 1', { fileName: 'demo.ts' })
```

返回：
- `bytecode`: 生成的字节码
- `function`: 函数字节码视图
- `module`: 模块条目（若是模块）
- `sourceFile`: TypeScript SourceFile

## compileFile

```ts
import { compileFile } from 'src/compiler'

const result = compileFile('fixtures/basic/array/basic.ts')
```

## CLI

```bash
pnpm run compile -- input.ts --out output.qjsc --dump
```

支持参数：
- `--out <file>`
- `--module`
- `--strip-debug`
- `--strip-source`
- `--dump`
