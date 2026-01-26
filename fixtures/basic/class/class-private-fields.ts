class Counter {
  #count = 0;

  increment() {
    this.#count++;
  }

  get value() {
    return this.#count;
  }
}

const c = new Counter();
c.increment();
console.log(c.value);
