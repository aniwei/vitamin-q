// ES2020 - 异步迭代器和 for-await-of
// Async Iterators and for-await-of

// 异步生成器
async function* asyncGenerator(): AsyncGenerator<number> {
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 100));
    yield i;
  }
}

// for-await-of 循环
async function consumeAsync(): Promise<void> {
  for await (const value of asyncGenerator()) {
    console.log("Async value:", value);
  }
}

consumeAsync();

// 自定义异步迭代器
const asyncIterable = {
  async *[Symbol.asyncIterator]() {
    yield await Promise.resolve(1);
    yield await Promise.resolve(2);
    yield await Promise.resolve(3);
  }
};

(async () => {
  for await (const num of asyncIterable) {
    console.log("Custom async:", num);
  }
})();

// 手动实现异步迭代器
class AsyncRange {
  constructor(private start: number, private end: number) {}
  
  [Symbol.asyncIterator](): AsyncIterator<number> {
    let current = this.start;
    const end = this.end;
    
    return {
      async next(): Promise<IteratorResult<number>> {
        await new Promise(r => setTimeout(r, 50));
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
}

(async () => {
  for await (const n of new AsyncRange(1, 5)) {
    console.log("Range:", n);
  }
})();

// 从 Promise 数组创建异步迭代
async function* fromPromises<T>(promises: Promise<T>[]): AsyncGenerator<T> {
  for (const promise of promises) {
    yield await promise;
  }
}

const promises = [
  Promise.resolve("first"),
  new Promise<string>(r => setTimeout(() => r("second"), 100)),
  Promise.resolve("third")
];

(async () => {
  for await (const result of fromPromises(promises)) {
    console.log("Promise result:", result);
  }
})();

// 流式数据处理
async function* readInChunks(data: string, chunkSize: number): AsyncGenerator<string> {
  for (let i = 0; i < data.length; i += chunkSize) {
    await new Promise(r => setTimeout(r, 10)); // 模拟 I/O
    yield data.slice(i, i + chunkSize);
  }
}

(async () => {
  const data = "Hello, this is a long string to be processed in chunks";
  for await (const chunk of readInChunks(data, 10)) {
    console.log("Chunk:", chunk);
  }
})();

// 管道组合
async function* map<T, U>(
  source: AsyncIterable<T>,
  fn: (item: T) => U | Promise<U>
): AsyncGenerator<U> {
  for await (const item of source) {
    yield await fn(item);
  }
}

async function* filter<T>(
  source: AsyncIterable<T>,
  predicate: (item: T) => boolean | Promise<boolean>
): AsyncGenerator<T> {
  for await (const item of source) {
    if (await predicate(item)) {
      yield item;
    }
  }
}

async function* take<T>(
  source: AsyncIterable<T>,
  count: number
): AsyncGenerator<T> {
  let taken = 0;
  for await (const item of source) {
    if (taken >= count) break;
    yield item;
    taken++;
  }
}

// 组合使用
(async () => {
  const source = asyncGenerator();
  const doubled = map(source, n => n * 2);
  const filtered = filter(doubled, n => n > 2);
  const limited = take(filtered, 2);
  
  for await (const value of limited) {
    console.log("Pipeline result:", value);
  }
})();

// 并发处理
async function* concurrent<T>(
  source: AsyncIterable<T>,
  concurrency: number
): AsyncGenerator<T> {
  const pending: Promise<IteratorResult<T>>[] = [];
  const iterator = source[Symbol.asyncIterator]();
  
  // 初始填充
  for (let i = 0; i < concurrency; i++) {
    pending.push(iterator.next());
  }
  
  while (pending.length > 0) {
    const result = await Promise.race(
      pending.map((p, i) => p.then(r => ({ result: r, index: i })))
    );
    
    pending.splice(result.index, 1);
    
    if (!result.result.done) {
      yield result.result.value;
      pending.push(iterator.next());
    }
  }
}
