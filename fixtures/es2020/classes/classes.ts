// classes
class Base {
  x: number;
  constructor(x: number) {
    this.x = x;
  }
  get val() {
    return this.x;
  }
  set val(v: number) {
    this.x = v;
  }
  static make(n: number) {
    return new Base(n);
  }
}

class Derived extends Base {
  constructor(x: number) {
    super(x);
  }
  inc() {
    return this.x + 1;
  }
  get superVal() {
    return super.val;
  }
  callSuper(v: number) {
    super.val = v;
    return super.val;
  }
}

const C = class {
  m() {
    return 1;
  }
};

void new Base(1);
void new Derived(2);
void C;
