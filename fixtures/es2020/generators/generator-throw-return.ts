// ES2020 - 生成器 throw 和 return
// 测试生成器的 throw() 和 return() 方法

function* errorHandlingGenerator(): Generator<number, void, unknown> {
  try {
    yield 1;
    yield 2;
    yield 3;
  } catch (e) {
    console.log("caught error:", e);
    yield -1;
  } finally {
    console.log("cleanup");
  }
}

// 测试 throw
const gen1 = errorHandlingGenerator();
console.log(gen1.next());  // { value: 1, done: false }
console.log(gen1.throw(new Error("test error"))); 
// caught error: Error: test error
// { value: -1, done: false }
console.log(gen1.next());  // cleanup, { value: undefined, done: true }

// 测试 return
const gen2 = errorHandlingGenerator();
console.log(gen2.next());  // { value: 1, done: false }
console.log(gen2.return(100)); 
// cleanup
// { value: 100, done: true }

// 带 finally 的生成器
function* generatorWithFinally(): Generator<number> {
  try {
    yield 1;
    yield 2;
  } finally {
    yield 99; // finally 中的 yield
    console.log("finally done");
  }
}

const gen3 = generatorWithFinally();
console.log(gen3.next());  // { value: 1, done: false }
console.log(gen3.return(0)); 
// { value: 99, done: false } - finally 中的 yield 先执行
console.log(gen3.next());
// finally done
// { value: 0, done: true }

// 无 try-catch 时的 throw
function* noTryCatch(): Generator<number> {
  yield 1;
  yield 2;
}

const gen4 = noTryCatch();
gen4.next();
try {
  gen4.throw(new Error("unhandled"));
} catch (e) {
  console.log("error propagated:", (e as Error).message);
}
