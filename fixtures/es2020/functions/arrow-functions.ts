// ES2020 - 箭头函数
// 测试各种箭头函数语法

// 基本箭头函数
const add = (a: number, b: number): number => a + b;
console.log(add(2, 3)); // 5

// 单参数（无括号）
const double = (x: number): number => x * 2;
console.log(double(5)); // 10

// 无参数
const getTimestamp = (): number => Date.now();
console.log(getTimestamp());

// 块体
const factorial = (n: number): number => {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
};
console.log(factorial(5)); // 120

// 返回对象字面量（需要括号）
const createPair = (a: number, b: number): { first: number; second: number } =>
  ({ first: a, second: b });
console.log(createPair(1, 2)); // { first: 1, second: 2 }

// 立即调用的箭头函数
const result = ((x: number) => x * x)(5);
console.log(result); // 25

// 箭头函数作为回调
const numbers = [1, 2, 3, 4, 5];
const squared = numbers.map(n => n * n);
const evens = numbers.filter(n => n % 2 === 0);
const sum = numbers.reduce((acc, n) => acc + n, 0);

console.log(squared); // [1, 4, 9, 16, 25]
console.log(evens);   // [2, 4]
console.log(sum);     // 15

// 嵌套箭头函数
const createAdder = (a: number) => (b: number) => a + b;
const add5 = createAdder(5);
console.log(add5(3)); // 8

// 箭头函数和 this（词法作用域）
class Timer {
  seconds: number = 0;
  
  start(): void {
    setInterval(() => {
      // 箭头函数保持 this 绑定
      this.seconds++;
      if (this.seconds >= 3) {
        console.log(`${this.seconds} seconds elapsed`);
      }
    }, 1000);
  }
}

// 异步箭头函数
const asyncFetch = async (url: string): Promise<string> => {
  return `Fetched from ${url}`;
};

asyncFetch("http://example.com").then(console.log);

// 生成器不能用箭头函数语法
// const gen = *() => {}; // SyntaxError
