// ES2020 - 类方法
// 测试各种类方法定义方式

class Calculator {
  // 普通方法
  add(a: number, b: number): number {
    return a + b;
  }
  
  subtract(a: number, b: number): number {
    return a - b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
  
  divide(a: number, b: number): number {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  }
  
  // 计算属性名方法
  ["power"](base: number, exp: number): number {
    return Math.pow(base, exp);
  }
  
  // 生成器方法
  *range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i;
    }
  }
  
  // 异步方法
  async fetchValue(): Promise<number> {
    return Promise.resolve(42);
  }
  
  // 异步生成器方法
  async *asyncRange(start: number, end: number): AsyncGenerator<number> {
    for (let i = start; i <= end; i++) {
      yield i;
    }
  }
}

const calc = new Calculator();
console.log(calc.add(2, 3));       // 5
console.log(calc.subtract(5, 2));  // 3
console.log(calc.multiply(4, 3));  // 12
console.log(calc.divide(10, 2));   // 5
console.log(calc.power(2, 8));     // 256

// 生成器方法
const nums: number[] = [];
for (const n of calc.range(1, 5)) {
  nums.push(n);
}
console.log(nums); // [1, 2, 3, 4, 5]

// 异步方法
calc.fetchValue().then(v => console.log(v)); // 42
