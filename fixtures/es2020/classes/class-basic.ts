// ES2020 - 类基础语法
// 测试基本类声明和实例化

class Person {
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
  
  name: string;
  age: number;
  
  greet(): string {
    return `Hello, I'm ${this.name}`;
  }
  
  getAge(): number {
    return this.age;
  }
}

const person = new Person("Alice", 30);
console.log(person.greet());
console.log(person.getAge());
