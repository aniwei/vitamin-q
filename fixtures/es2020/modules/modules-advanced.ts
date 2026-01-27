// ES2020 - 模块导入导出高级语法
// Import/Export 高级特性

// 动态导入 (Dynamic Import)
async function loadModule() {
  // 条件导入
  if (Math.random() > 0.5) {
    const module = await import("./modules-dep.js");
    console.log(module);
  }
  
  // 根据环境导入不同模块
  const config = await import(`./config-${process.env.NODE_ENV || 'dev'}.js`);
  console.log(config);
}

// import.meta - 模块元信息
console.log("Module URL:", import.meta.url);

// import.meta 自定义属性
const scriptDir = new URL(".", import.meta.url).pathname;
console.log("Script directory:", scriptDir);

// 导出聚合 (Export Aggregation)
// 假设有多个子模块

// 重命名导出
// export { foo as bar } from './other.js';

// 命名空间导出
// export * as utils from './utils.js';

// 默认导出变量
const defaultValue = { name: "module", version: "1.0.0" };
export default defaultValue;

// 命名导出
export const CONSTANT = 42;
export function helper(): void {
  console.log("helper called");
}

export class Service {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  
  run(): void {
    console.log(`Running ${this.name}`);
  }
}

// 类型导出 (TypeScript)
export type Config = {
  host: string;
  port: number;
};

export interface Logger {
  log(message: string): void;
  error(message: string): void;
}

// 重导出所有
// export * from './helpers.js';

// 混合导出
export { defaultValue as moduleInfo };

// 动态导入返回类型
type ModuleType = {
  default: typeof defaultValue;
  CONSTANT: number;
  helper: () => void;
  Service: typeof Service;
};

async function typedImport(): Promise<void> {
  const mod = await import("./modules.js") as ModuleType;
  console.log(mod.CONSTANT);
  mod.helper();
  const service = new mod.Service("test");
  service.run();
}

// 顶层 await (ES2022, 但通常与动态导入一起使用)
// const data = await fetch('...');

// 模块初始化
console.log("Module initialized");
