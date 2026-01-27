// ES2020 - 类静态成员
// 测试 static 关键字

class Counter {
  static count: number = 0;
  
  static increment(): number {
    return ++Counter.count;
  }
  
  static decrement(): number {
    return --Counter.count;
  }
  
  static reset(): void {
    Counter.count = 0;
  }
  
  static getCount(): number {
    return Counter.count;
  }
}

console.log(Counter.getCount()); // 0
console.log(Counter.increment()); // 1
console.log(Counter.increment()); // 2
console.log(Counter.decrement()); // 1
Counter.reset();
console.log(Counter.getCount()); // 0

// 静态块 (ES2022 特性，但 QuickJS 支持)
class Config {
  static settings: Record<string, any> = {};
  
  static {
    Config.settings['debug'] = true;
    Config.settings['version'] = '1.0.0';
  }
  
  static get(key: string): any {
    return Config.settings[key];
  }
}

console.log(Config.get('debug'));
console.log(Config.get('version'));
