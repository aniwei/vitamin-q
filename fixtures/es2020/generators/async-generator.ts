// ES2020 - 异步生成器
// 测试 async function* 语法

async function* asyncCounter(max: number): AsyncGenerator<number> {
  for (let i = 0; i < max; i++) {
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 10));
    yield i;
  }
}

// 使用 for-await-of 消费
async function consumeAsync(): Promise<void> {
  const values: number[] = [];
  for await (const v of asyncCounter(5)) {
    values.push(v);
  }
  console.log(values); // [0, 1, 2, 3, 4]
}

consumeAsync();

// 手动迭代
async function manualIteration(): Promise<void> {
  const gen = asyncCounter(3);
  console.log(await gen.next()); // { value: 0, done: false }
  console.log(await gen.next()); // { value: 1, done: false }
  console.log(await gen.next()); // { value: 2, done: false }
  console.log(await gen.next()); // { value: undefined, done: true }
}

manualIteration();

// 异步生成器与 yield*
async function* asyncNumbers(): AsyncGenerator<number> {
  yield 1;
  await Promise.resolve();
  yield 2;
}

async function* asyncLetters(): AsyncGenerator<string> {
  yield "a";
  await Promise.resolve();
  yield "b";
}

async function* combined(): AsyncGenerator<number | string> {
  yield* asyncNumbers();
  yield* asyncLetters();
}

async function testCombined(): Promise<void> {
  const results: (number | string)[] = [];
  for await (const v of combined()) {
    results.push(v);
  }
  console.log(results); // [1, 2, "a", "b"]
}

testCombined();

// 错误处理
async function* asyncWithError(): AsyncGenerator<number> {
  yield 1;
  throw new Error("async error");
}

async function testError(): Promise<void> {
  const gen = asyncWithError();
  console.log(await gen.next()); // { value: 1, done: false }
  try {
    await gen.next();
  } catch (e) {
    console.log("caught:", (e as Error).message);
  }
}

testError();
