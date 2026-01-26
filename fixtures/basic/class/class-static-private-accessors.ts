// ES2022: static private accessors
class Counter {
  static #x = 1

  static get #value() {
    return this.#x
  }

  static set #value(v) {
    this.#x = v
  }

  static bump() {
    this.#value = this.#value + 1
    return this.#value
  }
}

console.log(Counter.bump())
console.log(Counter.bump())
