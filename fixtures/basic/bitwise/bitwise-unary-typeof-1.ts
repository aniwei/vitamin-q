// 组合：bitwise + unary + typeof
const x = (31 | 3) ^ 5;
const y = ~x;
console.log(x, y, typeof y, !!y);
