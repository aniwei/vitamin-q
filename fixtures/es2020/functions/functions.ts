// functions
function add(a: number, b = 1) {
  return a + b;
}

const fnExpr = function (x: number) {
  return x * 2;
};

const arrow = (x: number, ...rest: number[]) => x + rest.length;

function outer() {
  function inner(y: number) {
    return y + 1;
  }
  return inner(1);
}

void add(1);
void fnExpr(2);
void arrow(3, 4, 5);
void outer();
