// ES2020 - Map 和 Set 高级用法
// Map and Set Advanced Usage

// Map 基础
const map = new Map<string, number>();
map.set("a", 1);
map.set("b", 2);
map.set("c", 3);

console.log(map.get("a"));    // 1
console.log(map.has("b"));    // true
console.log(map.size);        // 3

// Map 迭代
for (const [key, value] of map) {
  console.log(`${key}: ${value}`);
}

for (const key of map.keys()) {
  console.log("Key:", key);
}

for (const value of map.values()) {
  console.log("Value:", value);
}

map.forEach((value, key) => {
  console.log(`forEach: ${key} = ${value}`);
});

// Map 与对象作为键
const objKey = { id: 1 };
const objMap = new Map<object, string>();
objMap.set(objKey, "object value");
console.log(objMap.get(objKey)); // "object value"
console.log(objMap.get({ id: 1 })); // undefined - 不同对象

// Map 转换
const entries = [...map.entries()];
console.log(entries); // [["a", 1], ["b", 2], ["c", 3]]

const obj = Object.fromEntries(map);
console.log(obj); // { a: 1, b: 2, c: 3 }

const mapFromObj = new Map(Object.entries({ x: 10, y: 20 }));
console.log([...mapFromObj]); // [["x", 10], ["y", 20]]

// Set 基础
const set = new Set<number>([1, 2, 2, 3, 3, 3]);
console.log([...set]); // [1, 2, 3] - 自动去重

set.add(4);
set.delete(1);
console.log(set.has(2)); // true
console.log(set.size);   // 3

// Set 迭代
for (const value of set) {
  console.log("Set value:", value);
}

// Set 操作（手动实现）
function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter(x => b.has(x)));
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter(x => !b.has(x)));
}

const set1 = new Set([1, 2, 3, 4]);
const set2 = new Set([3, 4, 5, 6]);

console.log([...union(set1, set2)]);        // [1, 2, 3, 4, 5, 6]
console.log([...intersection(set1, set2)]); // [3, 4]
console.log([...difference(set1, set2)]);   // [1, 2]

// WeakMap - 弱键映射
const weakMap = new WeakMap<object, string>();
let key = { name: "weak" };
weakMap.set(key, "value");
console.log(weakMap.get(key)); // "value"
key = null!; // 键对象可被垃圾回收

// WeakSet - 弱对象集合
const weakSet = new WeakSet<object>();
let obj2 = { id: 1 };
weakSet.add(obj2);
console.log(weakSet.has(obj2)); // true
obj2 = null!; // 对象可被垃圾回收

// 实际用例：缓存
class Cache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // LRU: 移到末尾
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

// 实际用例：唯一值收集器
function uniqueBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 1, name: "Alice2" }
];

const unique = uniqueBy(users, u => u.id);
console.log(unique); // 只有前两个
