// ES2022: class field initializers (instance + static)
class C {
  a = 1
  b = this.a + 1

  static s = 10
  static t = C.s + 1
}

const c = new C()
console.log(c.b)
console.log(C.t)
