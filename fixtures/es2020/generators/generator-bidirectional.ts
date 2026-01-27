// ES2020 - 生成器双向通信
// 测试通过 next() 传值给生成器

function* twoWayGenerator(): Generator<string, void, number> {
  const a = yield "first";
  console.log("received a:", a);
  
  const b = yield "second";
  console.log("received b:", b);
  
  const c = yield "third";
  console.log("received c:", c);
}

const gen = twoWayGenerator();

// 第一次调用 next() 的参数被忽略
console.log(gen.next());        // { value: "first", done: false }
console.log(gen.next(10));      // received a: 10, { value: "second", done: false }
console.log(gen.next(20));      // received b: 20, { value: "third", done: false }
console.log(gen.next(30));      // received c: 30, { value: undefined, done: true }

// 累加器生成器
function* accumulator(): Generator<number, void, number> {
  let total = 0;
  while (true) {
    const value = yield total;
    if (value !== undefined) {
      total += value;
    }
  }
}

const acc = accumulator();
console.log(acc.next().value);     // 0
console.log(acc.next(5).value);    // 5
console.log(acc.next(10).value);   // 15
console.log(acc.next(3).value);    // 18

// 协程模式
function* task1(): Generator<string, void, string> {
  const msg = yield "task1: started";
  yield `task1: received ${msg}`;
}

function* task2(): Generator<string, void, string> {
  const msg = yield "task2: started";
  yield `task2: received ${msg}`;
}

const t1 = task1();
const t2 = task2();

console.log(t1.next().value);  // "task1: started"
console.log(t2.next().value);  // "task2: started"
console.log(t1.next("hello").value);  // "task1: received hello"
console.log(t2.next("world").value);  // "task2: received world"
