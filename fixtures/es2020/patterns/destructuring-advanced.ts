// ES2020 - 解构模式高级用法
// Destructuring Patterns

// 对象解构基础
const person = { name: "Alice", age: 30, city: "Beijing" };
const { name, age } = person;
console.log(name, age);

// 重命名
const { name: personName, age: personAge } = person;
console.log(personName, personAge);

// 默认值
const { country = "China" } = person as any;
console.log(country);

// 嵌套解构
const company = {
  name: "TechCorp",
  address: {
    city: "Shanghai",
    street: "Main St",
    building: {
      floor: 10,
      room: "A"
    }
  },
  employees: [
    { id: 1, name: "Bob" },
    { id: 2, name: "Carol" }
  ]
};

const {
  name: companyName,
  address: {
    city: companyCity,
    building: { floor }
  }
} = company;
console.log(companyName, companyCity, floor);

// 数组解构
const colors = ["red", "green", "blue", "yellow"];
const [first, second, ...rest] = colors;
console.log(first, second, rest);

// 跳过元素
const [, , third] = colors;
console.log(third); // "blue"

// 交换变量
let a = 1, b = 2;
[a, b] = [b, a];
console.log(a, b); // 2, 1

// 函数返回值解构
function getCoordinates(): [number, number] {
  return [10, 20];
}
const [x, y] = getCoordinates();
console.log(x, y);

// 对象与数组混合解构
const data = {
  items: [
    { id: 1, value: "first" },
    { id: 2, value: "second" }
  ],
  meta: { total: 2 }
};

const {
  items: [{ value: firstValue }, { value: secondValue }],
  meta: { total }
} = data;
console.log(firstValue, secondValue, total);

// 函数参数解构
function processUser({ 
  name, 
  age = 18,
  address: { city = "Unknown" } = {}
}: {
  name: string;
  age?: number;
  address?: { city?: string };
}): void {
  console.log(`${name}, ${age}, ${city}`);
}

processUser({ name: "Dave" });
processUser({ name: "Eve", age: 25, address: { city: "Tokyo" } });

// 计算属性名解构
const key = "dynamicKey";
const obj = { dynamicKey: "dynamic value" };
const { [key]: dynamicValue } = obj;
console.log(dynamicValue);

// 剩余属性
const { name: n, ...remaining } = company;
console.log(remaining); // 没有 name 的其他属性

// 数组解构与默认值
const sparse = [1, , 3];
const [one = 0, two = 0, three = 0] = sparse;
console.log(one, two, three); // 1, 0, 3

// 迭代器解构
const map = new Map<string, number>([
  ["a", 1],
  ["b", 2]
]);

for (const [k, v] of map) {
  console.log(`${k}: ${v}`);
}

// 解构赋值
let obj2: { x?: number; y?: number } = {};
({ x: obj2.x, y: obj2.y } = { x: 10, y: 20 });
console.log(obj2);
