// ES2020 - 类表达式
// 测试类表达式语法

// 匿名类表达式
const Point = class {
  x: number;
  y: number;
  
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  
  distanceTo(other: InstanceType<typeof Point>): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
};

// 命名类表达式
const Rectangle = class Rect {
  width: number;
  height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  
  area(): number {
    return this.width * this.height;
  }
  
  // 在类内部可以使用类名
  clone(): InstanceType<typeof Rectangle> {
    return new Rect(this.width, this.height);
  }
};

const p1 = new Point(0, 0);
const p2 = new Point(3, 4);
console.log(p1.distanceTo(p2)); // 5

const rect = new Rectangle(10, 5);
console.log(rect.area()); // 50

const cloned = rect.clone();
console.log(cloned.area()); // 50

// 立即调用的类表达式
const singleton = new (class {
  private static instance: any;
  value: number = 42;
  
  getValue(): number {
    return this.value;
  }
})();

console.log(singleton.getValue()); // 42
