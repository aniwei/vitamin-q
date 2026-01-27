// ES2020 - 计算属性名
// 测试类中的计算属性名

const methodName = "dynamicMethod";
const propName = "dynamicProp";
const prefix = "get";
const suffix = "Value";

class DynamicClass {
  // 计算属性字段
  [propName]: string = "hello";
  
  // 计算方法名
  [methodName](): string {
    return "called dynamic method";
  }
  
  // 表达式计算方法名
  [prefix + suffix](): number {
    return 42;
  }
  
  // Symbol 作为键
  [Symbol.iterator](): Iterator<number> {
    let i = 0;
    return {
      next(): IteratorResult<number> {
        if (i < 3) {
          return { value: i++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
  
  // 计算 getter/setter 名
  get [prefix + "Name"](): string {
    return "computed getter";
  }
  
  set [prefix + "Name"](value: string) {
    console.log("computed setter:", value);
  }
}

const obj = new DynamicClass();

// 访问计算属性
console.log(obj.dynamicProp);          // "hello"
console.log(obj.dynamicMethod());      // "called dynamic method"
console.log(obj.getValue());           // 42
console.log(obj.getName);              // "computed getter"

// 迭代
const values: number[] = [];
for (const v of obj) {
  values.push(v);
}
console.log(values);                   // [0, 1, 2]
