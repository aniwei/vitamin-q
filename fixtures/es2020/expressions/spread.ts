// spread in array/object/call
const base = [1, 2];
const arr = [0, ...base, 3];

const o1 = { a: 1 };
const o2 = { ...o1, b: 2 };

function sum(a: number, b: number, c: number) {
  return a + b + c;
}
const s = sum(...arr);

void arr;
void o2;
void s;
