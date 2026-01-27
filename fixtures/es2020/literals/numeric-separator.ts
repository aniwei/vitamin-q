// ES2020 - 数值分隔符
// 测试数值字面量中的下划线分隔符

// 十进制
const million: number = 1_000_000;
const billion: number = 1_000_000_000;
const price: number = 999_99; // 99999 (分)

console.log(million);  // 1000000
console.log(billion);  // 1000000000

// 小数
const pi: number = 3.141_592_653_589_793;
const gravity: number = 9.806_65;

console.log(pi);       // 3.141592653589793
console.log(gravity);  // 9.80665

// 十六进制
const hexColor: number = 0xFF_EC_DE;
const hexMax: number = 0xFF_FF_FF_FF;

console.log(hexColor.toString(16));  // "ffecde"
console.log(hexMax);                 // 4294967295

// 八进制
const octalPerm: number = 0o777_777;

console.log(octalPerm.toString(8));  // "777777"

// 二进制
const binaryFlags: number = 0b1010_1010_1010_1010;
const binaryByte: number = 0b1111_0000;

console.log(binaryFlags.toString(2));  // "1010101010101010"
console.log(binaryByte);               // 240

// BigInt 也支持分隔符
const bigNum: bigint = 1_000_000_000_000n;
const bigHex: bigint = 0xFF_FF_FF_FF_FF_FF_FF_FFn;

console.log(bigNum);   // 1000000000000n
console.log(bigHex);   // 18446744073709551615n

// 科学计数法
const avogadro: number = 6.022_140_76e23;
const planck: number = 6.626_070_15e-34;

console.log(avogadro);
console.log(planck);

// 分隔符可以放在任意位置 (除了开头、结尾和小数点旁边)
const arbitrary: number = 1_2_3_4_5;
console.log(arbitrary);  // 12345
