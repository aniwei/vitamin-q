// 组合：do-while + break/continue
let i = 0;
let s = 0;
do {
  i++;
  if (i === 2) continue;
  s += i;
  if (i > 3) break;
} while (i < 10);
console.log(s);
