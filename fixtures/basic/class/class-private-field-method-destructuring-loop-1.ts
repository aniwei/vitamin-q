// 组合：class + private field + method + destructuring + loop
class Acc20 {
  #x = 20;
  add(v) { this.#x += v; return this.#x; }
  getX() { return this.#x; }
}
const a = new Acc20();
let sum = 0;
for (let i = 0; i < 3; i++) {
  sum += a.add(i);
}
const { add } = { add: (x, y) => x + y };
console.log(a.getX(), sum, add(1, 2));
