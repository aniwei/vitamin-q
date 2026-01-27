// ES2020 - 类字段初始化器
// 测试类字段声明和初始化

class Widget {
  // 公共字段初始化器
  id: number = Math.random();
  name: string = "default";
  enabled: boolean = true;
  data: any[] = [];
  
  // 计算初始值
  createdAt: number = Date.now();
  
  constructor(name?: string) {
    if (name) {
      this.name = name;
    }
  }
  
  addData(item: any): void {
    this.data.push(item);
  }
  
  toggle(): void {
    this.enabled = !this.enabled;
  }
}

const widget1 = new Widget();
console.log(widget1.name);     // "default"
console.log(widget1.enabled);  // true

const widget2 = new Widget("custom");
console.log(widget2.name);     // "custom"

widget1.addData(1);
widget1.addData(2);
console.log(widget1.data);     // [1, 2]

// 每个实例有独立的数组
console.log(widget2.data);     // []

widget1.toggle();
console.log(widget1.enabled);  // false
