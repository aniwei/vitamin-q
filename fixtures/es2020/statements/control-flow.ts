// control flow
let i = 0;
while (i < 2) {
  i++;
}

do {
  i++;
} while (i < 4);

for (let j = 0; j < 2; j++) {
  if (j === 1) break;
}

const list = [1, 2];
for (const v of list) {
  if (v === 2) continue;
}

const obj = { a: 1, b: 2 };
for (const k in obj) {
  if (k === 'b') continue;
}

label1: for (let n = 0; n < 2; n++) {
  if (n === 1) break label1;
}

switch (i) {
  case 0:
    i = 1;
    break;
  default:
    i = 2;
}

void i;
