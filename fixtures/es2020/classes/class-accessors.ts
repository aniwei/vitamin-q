// ES2020 - 类访问器
// 测试 getter 和 setter

class Temperature {
  private _celsius: number = 0;
  
  get celsius(): number {
    return this._celsius;
  }
  
  set celsius(value: number) {
    this._celsius = value;
  }
  
  get fahrenheit(): number {
    return this._celsius * 9 / 5 + 32;
  }
  
  set fahrenheit(value: number) {
    this._celsius = (value - 32) * 5 / 9;
  }
  
  get kelvin(): number {
    return this._celsius + 273.15;
  }
  
  set kelvin(value: number) {
    this._celsius = value - 273.15;
  }
}

const temp = new Temperature();
temp.celsius = 25;
console.log(temp.celsius);     // 25
console.log(temp.fahrenheit);  // 77
console.log(temp.kelvin);      // 298.15

temp.fahrenheit = 32;
console.log(temp.celsius);     // 0

temp.kelvin = 373.15;
console.log(temp.celsius);     // 100
