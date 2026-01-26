// ES2022: private accessors
class Counter {
  #x = 0

  get #value() {
    return this.#x
  }

  set #value(v) {
    this.#x = v
  }

  inc() {
    this.#value = this.#value + 1
    return this.#value
  }
}

const c = new Counter()
console.log(c.inc())
console.log(c.inc())
