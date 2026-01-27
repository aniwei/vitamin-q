// ES2020 - 派生类构造函数
// 测试 super() 调用和 this 访问规则

class Vehicle {
  make: string;
  model: string;
  year: number;
  
  constructor(make: string, model: string, year: number) {
    this.make = make;
    this.model = model;
    this.year = year;
  }
  
  getInfo(): string {
    return `${this.year} ${this.make} ${this.model}`;
  }
}

class Car extends Vehicle {
  numDoors: number;
  
  constructor(make: string, model: string, year: number, numDoors: number) {
    // 必须先调用 super()
    super(make, model, year);
    // 然后才能访问 this
    this.numDoors = numDoors;
  }
  
  getInfo(): string {
    return `${super.getInfo()} - ${this.numDoors} doors`;
  }
}

class ElectricCar extends Car {
  batteryCapacity: number;
  range: number;
  
  constructor(make: string, model: string, year: number, batteryCapacity: number) {
    super(make, model, year, 4);
    this.batteryCapacity = batteryCapacity;
    this.range = batteryCapacity * 4; // 简化计算
  }
  
  getInfo(): string {
    return `${super.getInfo()} - ${this.batteryCapacity}kWh battery, ${this.range}km range`;
  }
}

// 条件性 super 调用
class SmartCar extends Vehicle {
  isElectric: boolean;
  
  constructor(make: string, model: string, year: number, isElectric: boolean = false) {
    super(make, model, year);
    this.isElectric = isElectric;
  }
}

const car = new Car("Toyota", "Camry", 2023, 4);
console.log(car.getInfo());

const tesla = new ElectricCar("Tesla", "Model 3", 2023, 75);
console.log(tesla.getInfo());

const smart = new SmartCar("Smart", "ForTwo", 2022, true);
console.log(smart.getInfo());
