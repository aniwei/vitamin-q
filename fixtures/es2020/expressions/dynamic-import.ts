// ES2020 - 动态导入
// 测试 import() 表达式

// 条件动态导入
async function loadModule(condition: boolean): Promise<any> {
  if (condition) {
    const module = await import('./module-a');
    return module.default;
  } else {
    const module = await import('./module-b');
    return module.default;
  }
}

// 动态路径
async function loadByName(name: string): Promise<any> {
  const module = await import(`./${name}`);
  return module;
}

// 并行加载多个模块
async function loadMultiple(): Promise<any[]> {
  const [a, b, c] = await Promise.all([
    import('./module-a'),
    import('./module-b'),
    import('./module-c')
  ]);
  return [a.default, b.default, c.default];
}

// 动态导入用于代码分割
class LazyLoader {
  private cache: Map<string, any> = new Map();
  
  async load(path: string): Promise<any> {
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }
    
    const module = await import(path);
    this.cache.set(path, module);
    return module;
  }
}

// 动态导入的元数据 (import.meta)
function getModuleInfo(): { url?: string } {
  return {
    url: typeof import.meta !== 'undefined' ? import.meta.url : undefined
  };
}

// 导入后立即执行
(async () => {
  try {
    // 这只是示例，实际执行需要模块存在
    // const utils = await import('./utils');
    // utils.doSomething();
    console.log("Dynamic import example");
  } catch (e) {
    console.log("Module not found");
  }
})();

// 导入 JSON (需要运行时支持)
async function loadConfig(): Promise<any> {
  try {
    const config = await import('./config.json');
    return config.default;
  } catch {
    return { default: {} };
  }
}

export { loadModule, loadByName, loadMultiple, LazyLoader };
