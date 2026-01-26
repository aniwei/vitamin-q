// destructuring patterns
const arr = [1, 2, 3];
const obj = { a: 1, b: 2, c: 3 };

const [a1, a2, ...restArr] = arr;
const { a, b: b2, ...restObj } = obj;

const [d1 = 10, d2 = 20] = [] as number[];
const { c: c1 = 30 } = {} as { c?: number };

let x = 0;
let y = 0;
({ a: x, b: y } = obj);

function f([p1, p2 = 2]: number[], { a: oa = 1 }: { a?: number }) {
  return p1 + p2 + oa;
}

void f([1], { a: 3 });
void a1;
void a2;
void restArr;
void restObj;
void d1;
void d2;
void c1;
