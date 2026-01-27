// ES2020 - 展开运算符高级用法
// Spread Operator Patterns

// 数组展开
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];

// 合并数组
const combined = [...arr1, ...arr2];
console.log(combined); // [1, 2, 3, 4, 5, 6]

// 在中间插入
const inserted = [...arr1, 0, ...arr2];
console.log(inserted); // [1, 2, 3, 0, 4, 5, 6]

// 数组克隆
const clone = [...arr1];
console.log(clone);

// 对象展开
const obj1 = { a: 1, b: 2 };
const obj2 = { c: 3, d: 4 };

// 合并对象
const merged = { ...obj1, ...obj2 };
console.log(merged); // { a: 1, b: 2, c: 3, d: 4 }

// 覆盖属性
const updated = { ...obj1, b: 10 };
console.log(updated); // { a: 1, b: 10 }

// 添加新属性
const extended = { ...obj1, e: 5 };
console.log(extended); // { a: 1, b: 2, e: 5 }

// 深层嵌套
const nested = {
  level1: {
    level2: {
      value: 1
    }
  }
};

const nestedClone = {
  ...nested,
  level1: {
    ...nested.level1,
    level2: {
      ...nested.level1.level2,
      value: 2
    }
  }
};
console.log(nestedClone);

// 函数调用展开
function sum(a: number, b: number, c: number): number {
  return a + b + c;
}

const numbers = [1, 2, 3] as const;
console.log(sum(...numbers)); // 6

// Math 函数
const values = [5, 2, 8, 1, 9];
console.log(Math.max(...values)); // 9
console.log(Math.min(...values)); // 1

// 构造函数展开
const dateArgs: [number, number, number] = [2023, 11, 25];
const date = new Date(...dateArgs);
console.log(date);

// 字符串展开
const str = "hello";
const chars = [...str];
console.log(chars); // ["h", "e", "l", "l", "o"]

// Set 展开
const set = new Set([1, 2, 2, 3, 3, 3]);
const uniqueArr = [...set];
console.log(uniqueArr); // [1, 2, 3]

// Map 展开
const map = new Map<string, number>([["a", 1], ["b", 2]]);
const entries = [...map];
console.log(entries); // [["a", 1], ["b", 2]]

// 条件展开
const condition = true;
const conditional = {
  always: 1,
  ...(condition && { optional: 2 }),
  ...(false && { never: 3 })
};
console.log(conditional); // { always: 1, optional: 2 }

// 数组条件展开
const maybeItems = true ? [4, 5] : [];
const conditionalArr = [1, 2, 3, ...maybeItems];
console.log(conditionalArr); // [1, 2, 3, 4, 5]

// 多层展开
const a = { x: 1 };
const b = { y: 2, ...a };
const c = { z: 3, ...b };
console.log(c); // { z: 3, y: 2, x: 1 }

// 与剩余参数结合
function process(first: number, ...rest: number[]): number[] {
  return [first * 2, ...rest.map(n => n * 3)];
}
console.log(process(1, 2, 3, 4)); // [2, 6, 9, 12]
