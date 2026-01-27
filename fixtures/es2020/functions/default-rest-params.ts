// ES2020 - 默认参数和剩余参数
// 测试函数参数的高级语法

// 默认参数
function greet(name: string = "World", greeting: string = "Hello"): string {
  return `${greeting}, ${name}!`;
}

console.log(greet());                     // "Hello, World!"
console.log(greet("Alice"));              // "Hello, Alice!"
console.log(greet("Alice", "Hi"));        // "Hi, Alice!"
console.log(greet(undefined, "Hey"));     // "Hey, World!"

// 默认参数表达式
function getDefault(): number {
  console.log("getDefault called");
  return 10;
}

function withDefaultExpr(x: number = getDefault()): number {
  return x * 2;
}

console.log(withDefaultExpr(5));   // 10 (getDefault 不被调用)
console.log(withDefaultExpr());    // 20 (getDefault 被调用)

// 默认参数引用前面的参数
function createRange(start: number = 0, end: number = start + 10): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}

console.log(createRange());      // [0, 1, 2, ..., 9]
console.log(createRange(5));     // [5, 6, 7, ..., 14]
console.log(createRange(5, 8));  // [5, 6, 7]

// 剩余参数
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

console.log(sum());           // 0
console.log(sum(1));          // 1
console.log(sum(1, 2, 3));    // 6
console.log(sum(1, 2, 3, 4, 5)); // 15

// 剩余参数与普通参数
function printf(format: string, ...args: any[]): string {
  return format.replace(/{(\d+)}/g, (match, index) => {
    return args[parseInt(index, 10)] !== undefined 
      ? String(args[parseInt(index, 10)]) 
      : match;
  });
}

console.log(printf("Hello {0}!", "World"));
console.log(printf("{0} + {1} = {2}", 1, 2, 3));

// 解构参数
function processUser({ name, age = 18 }: { name: string; age?: number }): string {
  return `${name} is ${age} years old`;
}

console.log(processUser({ name: "Alice" }));      // "Alice is 18 years old"
console.log(processUser({ name: "Bob", age: 25 })); // "Bob is 25 years old"

// 解构 + 默认值
function connect({
  host = "localhost",
  port = 3000,
  secure = false
}: {
  host?: string;
  port?: number;
  secure?: boolean;
} = {}): string {
  const protocol = secure ? "https" : "http";
  return `${protocol}://${host}:${port}`;
}

console.log(connect());                        // "http://localhost:3000"
console.log(connect({ port: 8080 }));          // "http://localhost:8080"
console.log(connect({ host: "api.example.com", secure: true }));
