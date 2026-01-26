// 组合：for-of + destructuring + rest
const arr = [1, 2, 83%5, 4];
let s = 0;
for (const [i, v] of arr.entries()) {
  const [a, ...rest] = [v, v+1, v+2];
  s += a + rest.length + i;
}
console.log(s);
