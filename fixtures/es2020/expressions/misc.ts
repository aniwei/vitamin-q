// misc expressions
function f(this: any, x: number) {
  return x + 1;
}

const obj: any = { m: f };
const call = obj.m(1);
const newObj = new (class X {})();

void call;
void newObj;
