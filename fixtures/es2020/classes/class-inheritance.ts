// ES2020 - 类继承
// 测试 extends 和 super 关键字

class Animal {
  constructor(name: string) {
    this.name = name;
  }
  
  name: string;
  
  speak(): string {
    return `${this.name} makes a sound`;
  }
}

class Dog extends Animal {
  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }
  
  breed: string;
  
  speak(): string {
    return `${this.name} barks`;
  }
  
  getBreed(): string {
    return this.breed;
  }
}

class Cat extends Animal {
  constructor(name: string) {
    super(name);
  }
  
  speak(): string {
    return `${super.speak()} - meow!`;
  }
}

const dog = new Dog("Buddy", "Golden Retriever");
console.log(dog.speak());
console.log(dog.getBreed());

const cat = new Cat("Whiskers");
console.log(cat.speak());
