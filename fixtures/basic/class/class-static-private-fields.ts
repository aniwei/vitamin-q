// ES2022: static private fields
class Counter {
  static #count = 0

  static inc() {
    this.#count++
    return this.#count
  }
}

console.log(Counter.inc())
console.log(Counter.inc())
