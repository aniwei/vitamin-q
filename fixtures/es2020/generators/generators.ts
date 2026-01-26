// generators
function* gen() {
  yield 1;
  yield* [2, 3];
  return 4;
}

async function* agen() {
  yield 1;
  yield* [2];
}

const it = gen();
void it.next();
void agen();
