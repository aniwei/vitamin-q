// 覆盖：for 语句的省略分量（init/cond/increment）+ continue/break
let i = 0;
for (;;) {
  if (i >= 2) break;
  console.log(i);
  i++;
}

let j = 0;
for (; j < 3;) {
  if (j === 1) {
    j++;
    continue;
  }
  console.log(j);
  j++;
}
