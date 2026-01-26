class Counter {
  static #count = 0
  static label = 'counter'

  static {
    this.#count = 1
    this.label = 'booted'
  }

  static #bump() {
    this.#count += 1
  }

  static inc() {
    this.#bump()
    return this.#count
  }

  static get value() {
    return this.#count
  }
}

console.log(Counter.label)
console.log(Counter.inc())
console.log(Counter.value)
