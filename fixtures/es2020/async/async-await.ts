// async/await
async function asyncAdd(a: number, b: number) {
  const v = await Promise.resolve(a + b);
  return v;
}

const asyncArrow = async (x: number) => {
  const v = await Promise.resolve(x);
  return v;
};

async function asyncFor() {
  const list = [Promise.resolve(1), Promise.resolve(2)];
  const out: number[] = [];
  for await (const v of list) {
    out.push(v);
  }
  return out;
}

void asyncAdd(1, 2);
void asyncArrow(3);
void asyncFor();
