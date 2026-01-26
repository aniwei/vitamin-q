// 组合：destructuring defaults + rest + object pattern
const src = { a: 18, b: undefined, c: 3, d: 4 };
const { a, b = 2, ...rest } = src;
console.log(a, b, rest.c + rest.d);
