// ES2020 - Proxy 和 Reflect
// Proxy and Reflect API

// 基本 Proxy
const target = { a: 1, b: 2 };

const handler: ProxyHandler<typeof target> = {
  get(target, prop, receiver) {
    console.log(`Getting ${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    console.log(`Setting ${String(prop)} to ${value}`);
    return Reflect.set(target, prop, value, receiver);
  }
};

const proxy = new Proxy(target, handler);
console.log(proxy.a);  // Getting a, 1
proxy.b = 10;          // Setting b to 10

// 验证 Proxy
const validatedTarget: Record<string, number> = {};

const validationHandler: ProxyHandler<typeof validatedTarget> = {
  set(target, prop, value) {
    if (typeof value !== "number") {
      throw new TypeError("Only numbers allowed");
    }
    if (value < 0) {
      throw new RangeError("No negative numbers");
    }
    target[prop as string] = value;
    return true;
  }
};

const validated = new Proxy(validatedTarget, validationHandler);
validated.count = 42;  // OK
// validated.name = "test"; // 抛出 TypeError
// validated.negative = -1; // 抛出 RangeError

// 可撤销 Proxy
const { proxy: revocableProxy, revoke } = Proxy.revocable(
  { value: 100 },
  {
    get(target, prop) {
      return Reflect.get(target, prop);
    }
  }
);

console.log(revocableProxy.value); // 100
revoke();
// console.log(revocableProxy.value); // TypeError: Cannot perform 'get' on a proxy that has been revoked

// 函数 Proxy
function originalFn(a: number, b: number): number {
  return a + b;
}

const fnProxy = new Proxy(originalFn, {
  apply(target, thisArg, args) {
    console.log(`Calling with args: ${args}`);
    const result = Reflect.apply(target, thisArg, args);
    console.log(`Result: ${result}`);
    return result;
  }
});

fnProxy(1, 2); // Calling with args: 1,2, Result: 3

// 构造函数 Proxy
class OriginalClass {
  constructor(public name: string) {}
}

const ClassProxy = new Proxy(OriginalClass, {
  construct(target, args) {
    console.log(`Constructing with: ${args}`);
    return Reflect.construct(target, args);
  }
});

const instance = new ClassProxy("test");
console.log(instance.name);

// 所有 Proxy 陷阱
const fullHandler: ProxyHandler<any> = {
  // 属性访问
  get(target, prop, receiver) {
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver);
  },
  has(target, prop) {
    return Reflect.has(target, prop);
  },
  deleteProperty(target, prop) {
    return Reflect.deleteProperty(target, prop);
  },
  
  // 属性定义
  defineProperty(target, prop, descriptor) {
    return Reflect.defineProperty(target, prop, descriptor);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
  
  // 对象扩展
  preventExtensions(target) {
    return Reflect.preventExtensions(target);
  },
  isExtensible(target) {
    return Reflect.isExtensible(target);
  },
  
  // 原型
  getPrototypeOf(target) {
    return Reflect.getPrototypeOf(target);
  },
  setPrototypeOf(target, proto) {
    return Reflect.setPrototypeOf(target, proto);
  },
  
  // 键枚举
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
  
  // 函数调用
  apply(target, thisArg, args) {
    return Reflect.apply(target, thisArg, args);
  },
  construct(target, args, newTarget) {
    return Reflect.construct(target, args, newTarget);
  }
};

// Reflect API 独立使用
const obj2 = { x: 1, y: 2 };

// 属性操作
console.log(Reflect.get(obj2, "x")); // 1
Reflect.set(obj2, "z", 3);
console.log(Reflect.has(obj2, "z")); // true

// 定义属性
Reflect.defineProperty(obj2, "readonly", {
  value: "immutable",
  writable: false,
  configurable: false
});

// 获取所有键
console.log(Reflect.ownKeys(obj2)); // ["x", "y", "z", "readonly"]

// 原型操作
const proto = { inherited: true };
Reflect.setPrototypeOf(obj2, proto);
console.log(Reflect.getPrototypeOf(obj2) === proto); // true

// 响应式系统示例
function reactive<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      console.log(`[track] ${String(prop)}`);
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      console.log(`[trigger] ${String(prop)} = ${value}`);
      return result;
    }
  });
}

const state = reactive({ count: 0 });
state.count;      // [track] count
state.count = 1;  // [trigger] count = 1
