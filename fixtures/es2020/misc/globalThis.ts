// ES2020 - globalThis
// 全局对象统一访问

// globalThis 提供了跨环境的全局对象访问
// 在浏览器中是 window，Node.js 中是 global

// 基本使用
console.log(typeof globalThis);       // "object"
console.log(globalThis === globalThis); // true

// 在全局作用域定义属性
(globalThis as any).myGlobal = "Hello from globalThis";
console.log((globalThis as any).myGlobal);

// 检查全局函数
console.log(typeof globalThis.setTimeout);
console.log(typeof globalThis.console);
console.log(typeof globalThis.Math);

// 用于 polyfill 检测和安装
if (typeof (globalThis as any).customFeature === "undefined") {
  (globalThis as any).customFeature = function() {
    return "polyfilled";
  };
}

// globalThis 上的标准对象
const globals = [
  "Object",
  "Array",
  "Function",
  "Number",
  "String",
  "Boolean",
  "Symbol",
  "Math",
  "JSON",
  "Date",
  "RegExp",
  "Error",
  "Promise",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Proxy",
  "Reflect",
];

for (const name of globals) {
  console.log(`${name}:`, typeof (globalThis as any)[name]);
}

// 动态访问全局变量
function getGlobal(name: string): any {
  return (globalThis as any)[name];
}

console.log(getGlobal("Array") === Array); // true
console.log(getGlobal("Math") === Math);   // true

// 类中使用 globalThis
class GlobalAccessor {
  getValue(key: string): any {
    return (globalThis as any)[key];
  }
  
  setValue(key: string, value: any): void {
    (globalThis as any)[key] = value;
  }
}

const accessor = new GlobalAccessor();
accessor.setValue("testValue", 42);
console.log(accessor.getValue("testValue")); // 42
