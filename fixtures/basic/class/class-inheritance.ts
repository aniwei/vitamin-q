class Animal {
  name;
  constructor(name) {
    this.name = name;
  }
  speak() {
    console.log("Animal speaks");
  }
}

class Dog extends Animal {
  breed;
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }
  speak() {
    super.speak();
    console.log("Dog barks");
  }
}

const d = new Dog("Rex", "German Shepherd");
d.speak();
