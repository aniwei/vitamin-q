// ES2020 - Symbol 高级用法
// Symbol Advanced Usage

// 基本 Symbol 创建
const sym1 = Symbol("description");
const sym2 = Symbol("description");
console.log(sym1 === sym2); // false - 每个 Symbol 都是唯一的

// Symbol 描述
console.log(sym1.description); // "description"

// 作为对象属性键
const mySymbol = Symbol("myKey");
const obj = {
  [mySymbol]: "symbol value",
  regularKey: "regular value"
};

console.log(obj[mySymbol]); // "symbol value"
console.log(Object.keys(obj)); // ["regularKey"] - Symbol 不在普通枚举中

// 获取 Symbol 属性
console.log(Object.getOwnPropertySymbols(obj)); // [Symbol(myKey)]
console.log(Reflect.ownKeys(obj)); // ["regularKey", Symbol(myKey)]

// 全局 Symbol 注册表
const globalSym = Symbol.for("global.key");
const sameGlobalSym = Symbol.for("global.key");
console.log(globalSym === sameGlobalSym); // true

console.log(Symbol.keyFor(globalSym)); // "global.key"
console.log(Symbol.keyFor(sym1)); // undefined - 非全局 Symbol

// 内置 Symbol

// Symbol.iterator - 定义迭代器
const iterableObj = {
  data: [1, 2, 3],
  [Symbol.iterator]() {
    let index = 0;
    const data = this.data;
    return {
      next() {
        if (index < data.length) {
          return { value: data[index++], done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
};

for (const item of iterableObj) {
  console.log("Iterator item:", item);
}

// Symbol.asyncIterator - 异步迭代器
const asyncIterable = {
  async *[Symbol.asyncIterator]() {
    yield 1;
    yield 2;
    yield 3;
  }
};

(async () => {
  for await (const item of asyncIterable) {
    console.log("Async item:", item);
  }
})();

// Symbol.toStringTag - 自定义 toString 标签
class MyClass {
  get [Symbol.toStringTag]() {
    return "MyClass";
  }
}

const instance = new MyClass();
console.log(Object.prototype.toString.call(instance)); // "[object MyClass]"

// Symbol.toPrimitive - 自定义类型转换
const customObj = {
  [Symbol.toPrimitive](hint: string) {
    switch (hint) {
      case "number":
        return 42;
      case "string":
        return "custom string";
      default:
        return "default";
    }
  }
};

console.log(+customObj);       // 42
console.log(`${customObj}`);   // "custom string"
console.log(customObj + "");   // "default"

// Symbol.hasInstance - 自定义 instanceof
class MyArray {
  static [Symbol.hasInstance](instance: any) {
    return Array.isArray(instance);
  }
}

console.log([] instanceof (MyArray as any)); // true
console.log({} instanceof (MyArray as any)); // false

// Symbol.species - 指定派生构造函数
class SpecialArray<T> extends Array<T> {
  static get [Symbol.species]() {
    return Array;
  }
}

const special = new SpecialArray(1, 2, 3);
const mapped = special.map(x => x * 2);
console.log(mapped instanceof SpecialArray); // false
console.log(mapped instanceof Array);        // true

// Symbol.isConcatSpreadable
const spreadable = {
  length: 2,
  0: "a",
  1: "b",
  [Symbol.isConcatSpreadable]: true
};

console.log([1, 2].concat(spreadable as any)); // [1, 2, "a", "b"]

// 私有属性模式
const _private = Symbol("private");

class WithPrivate {
  [_private]: string;
  
  constructor(secret: string) {
    this[_private] = secret;
  }
  
  getSecret(): string {
    return this[_private];
  }
}

const wp = new WithPrivate("secret value");
console.log(wp.getSecret()); // "secret value"
