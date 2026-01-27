// ES2020 - Promise 链和错误处理
// Promise Chaining and Error Handling

// 基本 Promise 链
function fetchUser(id: number): Promise<{ id: number; name: string }> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) {
        resolve({ id, name: `User${id}` });
      } else {
        reject(new Error("Invalid ID"));
      }
    }, 100);
  });
}

function fetchPosts(userId: number): Promise<string[]> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([`Post1 by ${userId}`, `Post2 by ${userId}`]);
    }, 100);
  });
}

// 链式调用
fetchUser(1)
  .then(user => {
    console.log("User:", user);
    return fetchPosts(user.id);
  })
  .then(posts => {
    console.log("Posts:", posts);
  })
  .catch(error => {
    console.error("Error:", error);
  })
  .finally(() => {
    console.log("Complete");
  });

// Promise.all
async function fetchAllUsers(): Promise<void> {
  const userPromises = [1, 2, 3].map(id => fetchUser(id));
  const users = await Promise.all(userPromises);
  console.log("All users:", users);
}

fetchAllUsers();

// Promise.race
async function raceExample(): Promise<void> {
  const slow = new Promise(resolve => setTimeout(() => resolve("slow"), 1000));
  const fast = new Promise(resolve => setTimeout(() => resolve("fast"), 100));
  
  const winner = await Promise.race([slow, fast]);
  console.log("Winner:", winner); // "fast"
}

raceExample();

// Promise.any (ES2021, 但相关)
async function anyExample(): Promise<void> {
  const p1 = Promise.reject("error1");
  const p2 = new Promise(resolve => setTimeout(() => resolve("success2"), 100));
  const p3 = new Promise(resolve => setTimeout(() => resolve("success3"), 200));
  
  try {
    const first = await Promise.any([p1, p2, p3]);
    console.log("First success:", first); // "success2"
  } catch (e) {
    console.log("All rejected");
  }
}

anyExample();

// 错误恢复
async function withRecovery(): Promise<string> {
  return fetchUser(-1)
    .catch(error => {
      console.log("Recovering from:", error.message);
      return { id: 0, name: "Default" };
    })
    .then(user => user.name);
}

withRecovery().then(name => console.log("Got name:", name));

// 重试机制
async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 100
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// 超时包装
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}

// 并发限制
async function pooled<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = fn(item).then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
}

// Promise.resolve / Promise.reject
console.log(await Promise.resolve(42));
try {
  await Promise.reject("explicit reject");
} catch (e) {
  console.log("Caught:", e);
}

// Thenable 对象
const thenable = {
  then(resolve: (value: number) => void) {
    setTimeout(() => resolve(100), 10);
  }
};

Promise.resolve(thenable).then(v => console.log("Thenable value:", v));
