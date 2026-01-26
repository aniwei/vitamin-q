// 组合：closure + recursion + default params
function make5(base = 5) {
  function f(k = 2) {
    if (k <= 0) return base;
    return f(k - 1) + 1;
  }
  return f;
}
const g = make5();
console.log(g(3));
