// ES2020 - Promise.allSettled
// 等待所有 Promise 完成（无论成功或失败）

// 基本使用
const promises = [
  Promise.resolve(1),
  Promise.reject("error"),
  Promise.resolve(3),
];

Promise.allSettled(promises).then(results => {
  console.log("All settled:", results);
  // [
  //   { status: "fulfilled", value: 1 },
  //   { status: "rejected", reason: "error" },
  //   { status: "fulfilled", value: 3 }
  // ]
});

// 与 Promise.all 对比
// Promise.all 在遇到第一个 rejected 时就会立即 reject
// Promise.allSettled 会等待所有 promises 完成

async function demonstrateDifference(): Promise<void> {
  const tasks = [
    Promise.resolve("task1"),
    Promise.reject("task2 failed"),
    Promise.resolve("task3"),
  ];

  // Promise.allSettled - 总是完成
  const settled = await Promise.allSettled(tasks);
  console.log("Settled:", settled.length); // 3

  // Promise.all - 会因为 task2 而 reject
  try {
    await Promise.all([
      Promise.resolve("a"),
      Promise.reject("b"),
      Promise.resolve("c"),
    ]);
  } catch (e) {
    console.log("All rejected with:", e); // "b"
  }
}

demonstrateDifference();

// 实际用例：批量请求处理
interface FetchResult {
  url: string;
  success: boolean;
  data?: any;
  error?: string;
}

async function fetchMultiple(urls: string[]): Promise<FetchResult[]> {
  const fetchPromises = urls.map(url =>
    fetch(url)
      .then(r => r.json())
      .then(data => ({ url, success: true, data }))
      .catch(error => ({ url, success: false, error: String(error) }))
  );

  // 这里用 allSettled 只是演示，实际上面已经处理了 catch
  const results = await Promise.allSettled(fetchPromises);
  
  return results.map(result => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return { url: "unknown", success: false, error: result.reason };
  });
}

// 分类结果
async function processWithCategories(): Promise<void> {
  const promises = [
    Promise.resolve(10),
    Promise.reject(new Error("failed")),
    Promise.resolve(30),
    Promise.reject("simple error"),
    Promise.resolve(50),
  ];

  const results = await Promise.allSettled(promises);

  const fulfilled = results
    .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
    .map(r => r.value);

  const rejected = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map(r => r.reason);

  console.log("Fulfilled:", fulfilled); // [10, 30, 50]
  console.log("Rejected:", rejected);   // [Error, "simple error"]
}

processWithCategories();

// 超时处理
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout")), ms);
  });
  return Promise.race([promise, timeout]);
}

async function fetchWithTimeouts(): Promise<void> {
  const tasks = [
    withTimeout(Promise.resolve(1), 1000),
    withTimeout(new Promise(r => setTimeout(() => r(2), 500)), 1000),
    withTimeout(new Promise(r => setTimeout(() => r(3), 2000)), 1000), // 会超时
  ];

  const results = await Promise.allSettled(tasks);
  console.log("With timeouts:", results);
}

fetchWithTimeouts();
