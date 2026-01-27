// ES2020 - 生成器基础
// 测试 function* 和 yield 语法

function* simpleGenerator(): Generator<number> {
  yield 1;
  yield 2;
  yield 3;
}

// 基本使用
const gen = simpleGenerator();
console.log(gen.next()); // { value: 1, done: false }
console.log(gen.next()); // { value: 2, done: false }
console.log(gen.next()); // { value: 3, done: false }
console.log(gen.next()); // { value: undefined, done: true }

// for-of 迭代
const values: number[] = [];
for (const v of simpleGenerator()) {
  values.push(v);
}
console.log(values); // [1, 2, 3]

// 带返回值的生成器
function* generatorWithReturn(): Generator<number, string, unknown> {
  yield 1;
  yield 2;
  return "done";
}

const gen2 = generatorWithReturn();
console.log(gen2.next()); // { value: 1, done: false }
console.log(gen2.next()); // { value: 2, done: false }
console.log(gen2.next()); // { value: "done", done: true }

// 无限生成器
function* infiniteCounter(): Generator<number> {
  let i = 0;
  while (true) {
    yield i++;
  }
}

const counter = infiniteCounter();
console.log(counter.next().value); // 0
console.log(counter.next().value); // 1
console.log(counter.next().value); // 2
