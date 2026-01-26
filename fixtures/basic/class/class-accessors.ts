class Box {
  _value = 0;
  
  get value() {
    console.log("Getting value");
    return this._value;
  }
  
  set value(v) {
    console.log("Setting value");
    this._value = v;
  }
}

const b = new Box();
b.value = 10;
console.log(b.value);
