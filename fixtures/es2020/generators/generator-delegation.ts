// ES2020 - yield* 委托
// 测试 yield* 语法用于生成器委托

function* innerGenerator(): Generator<number> {
  yield 1;
  yield 2;
}

function* outerGenerator(): Generator<number> {
  yield 0;
  yield* innerGenerator(); // 委托给内部生成器
  yield 3;
}

// 测试委托
const values: number[] = [];
for (const v of outerGenerator()) {
  values.push(v);
}
console.log(values); // [0, 1, 2, 3]

// yield* 可以委托给任何可迭代对象
function* yieldArray(): Generator<number> {
  yield* [1, 2, 3];
}

function* yieldString(): Generator<string> {
  yield* "abc";
}

function* yieldSet(): Generator<number> {
  yield* new Set([1, 2, 3]);
}

console.log([...yieldArray()]);  // [1, 2, 3]
console.log([...yieldString()]); // ["a", "b", "c"]
console.log([...yieldSet()]);    // [1, 2, 3]

// 嵌套委托
function* level1(): Generator<number> {
  yield 1;
}

function* level2(): Generator<number> {
  yield* level1();
  yield 2;
}

function* level3(): Generator<number> {
  yield* level2();
  yield 3;
}

console.log([...level3()]); // [1, 2, 3]

// yield* 返回值
function* genWithReturn(): Generator<number, string, unknown> {
  yield 1;
  return "inner result";
}

function* delegatingGen(): Generator<number | string> {
  const result = yield* genWithReturn();
  yield result; // "inner result"
}

console.log([...delegatingGen()]); // [1, "inner result"]
