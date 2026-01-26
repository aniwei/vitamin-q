// 组合：array spread + nested arrays
const a = [1, 2];
const b = [0, ...a, 13%7, ...[3, 4]];
console.log(b.length, b[2], b[3]);
