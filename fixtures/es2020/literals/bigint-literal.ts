// ES2020 - BigInt 字面量
// 测试 BigInt 语法和操作

// BigInt 字面量
const big1: bigint = 123n;
const big2: bigint = 9007199254740991n; // Number.MAX_SAFE_INTEGER
const big3: bigint = 9007199254740992n; // 超出安全整数范围

// 负数
const negative: bigint = -42n;

// 十六进制
const hex: bigint = 0xFFFFFFFFFFFFFFFFn;

// 八进制
const octal: bigint = 0o777n;

// 二进制
const binary: bigint = 0b1111111111111111n;

// BigInt 运算
console.log(big1 + big2);        // 加法
console.log(big2 - big1);        // 减法
console.log(big1 * 2n);          // 乘法
console.log(big2 / 10n);         // 除法 (向下取整)
console.log(big2 % 10n);         // 取模
console.log(big1 ** 3n);         // 幂运算

// 位运算
console.log(big1 & 0xFFn);       // 与
console.log(big1 | 0xFF00n);     // 或
console.log(big1 ^ 0xFFn);       // 异或
console.log(~big1);              // 非
console.log(big1 << 8n);         // 左移
console.log(big1 >> 2n);         // 右移

// 比较
console.log(big1 < big2);        // true
console.log(big1 === 123n);      // true
console.log(big1 == 123);        // true (类型强制转换)

// BigInt 和 Number 不能直接混合运算
// console.log(big1 + 1); // TypeError

// 需要显式转换
console.log(big1 + BigInt(1));   // 124n
console.log(Number(big1) + 1);   // 124

// 大数计算示例
const factorial = (n: bigint): bigint => {
  if (n <= 1n) return 1n;
  return n * factorial(n - 1n);
};

console.log(factorial(20n));     // 2432902008176640000n
console.log(factorial(50n));     // 非常大的数
