// ES2020 - WeakRef 和 FinalizationRegistry
// WeakRef and FinalizationRegistry (ES2021, but related)

// WeakRef - 弱引用
class ExpensiveObject {
  data: number[];
  
  constructor(size: number) {
    this.data = new Array(size).fill(0).map((_, i) => i);
    console.log(`Created ExpensiveObject with ${size} items`);
  }
  
  process(): number {
    return this.data.reduce((a, b) => a + b, 0);
  }
}

// 创建弱引用
let obj: ExpensiveObject | null = new ExpensiveObject(1000);
const weakRef = new WeakRef(obj);

// 通过弱引用访问对象
const deref = weakRef.deref();
if (deref) {
  console.log("Object still alive:", deref.process());
}

// 对象可能被垃圾回收
obj = null;
// 此后 weakRef.deref() 可能返回 undefined

// 缓存示例
class WeakCache<K extends object, V> {
  private cache = new Map<K, WeakRef<V & object>>();
  private registry: FinalizationRegistry<K>;
  
  constructor() {
    this.registry = new FinalizationRegistry((key: K) => {
      const ref = this.cache.get(key);
      if (ref && !ref.deref()) {
        this.cache.delete(key);
        console.log("Cache entry cleaned up");
      }
    });
  }
  
  set(key: K, value: V & object): void {
    const ref = new WeakRef(value);
    this.cache.set(key, ref);
    this.registry.register(value, key, value);
  }
  
  get(key: K): V | undefined {
    const ref = this.cache.get(key);
    if (ref) {
      const value = ref.deref();
      if (value) {
        return value;
      }
      // 对象已被回收
      this.cache.delete(key);
    }
    return undefined;
  }
  
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }
}

// FinalizationRegistry - 清理回调
const registry = new FinalizationRegistry((heldValue: string) => {
  console.log(`Object with id "${heldValue}" was garbage collected`);
});

function createTrackedObject(id: string): object {
  const obj = { id, data: new Array(100) };
  registry.register(obj, id);
  return obj;
}

// 创建一些被跟踪的对象
let tracked1: object | null = createTrackedObject("obj-1");
let tracked2: object | null = createTrackedObject("obj-2");

// 取消注册
registry.unregister(tracked2!);

// 释放引用
tracked1 = null;
tracked2 = null;

// 当 GC 运行时，只有 "obj-1" 会触发清理回调
// （因为 obj-2 已被取消注册）

// 实际用例：DOM 元素监听器清理
interface ElementInfo {
  element: WeakRef<Element>;
  listeners: Map<string, EventListener>;
}

class EventManager {
  private elements = new Map<string, ElementInfo>();
  private registry: FinalizationRegistry<string>;
  
  constructor() {
    this.registry = new FinalizationRegistry((elementId: string) => {
      console.log(`Cleaning up listeners for removed element: ${elementId}`);
      this.elements.delete(elementId);
    });
  }
  
  register(elementId: string, element: Element): void {
    const info: ElementInfo = {
      element: new WeakRef(element),
      listeners: new Map()
    };
    this.elements.set(elementId, info);
    this.registry.register(element, elementId, element);
  }
  
  addEventListener(elementId: string, event: string, listener: EventListener): void {
    const info = this.elements.get(elementId);
    if (info) {
      const element = info.element.deref();
      if (element) {
        element.addEventListener(event, listener);
        info.listeners.set(event, listener);
      }
    }
  }
  
  removeEventListener(elementId: string, event: string): void {
    const info = this.elements.get(elementId);
    if (info) {
      const element = info.element.deref();
      const listener = info.listeners.get(event);
      if (element && listener) {
        element.removeEventListener(event, listener);
        info.listeners.delete(event);
      }
    }
  }
}

// 注意：WeakRef 和 FinalizationRegistry 不保证回调何时执行
// 不应该依赖它们进行程序逻辑，只用于资源清理优化
