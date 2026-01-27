// ES2020 - 控制流语句综合
// Control Flow Statements

// switch 语句
function getDayName(day: number): string {
  switch (day) {
    case 0:
      return "Sunday";
    case 1:
      return "Monday";
    case 2:
      return "Tuesday";
    case 3:
      return "Wednesday";
    case 4:
      return "Thursday";
    case 5:
      return "Friday";
    case 6:
      return "Saturday";
    default:
      return "Unknown";
  }
}

console.log(getDayName(3)); // "Wednesday"

// switch with fallthrough
function getQuarter(month: number): number {
  switch (month) {
    case 1:
    case 2:
    case 3:
      return 1;
    case 4:
    case 5:
    case 6:
      return 2;
    case 7:
    case 8:
    case 9:
      return 3;
    case 10:
    case 11:
    case 12:
      return 4;
    default:
      return 0;
  }
}

console.log(getQuarter(5)); // 2

// labeled statements
outer: for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (i === 1 && j === 1) {
      break outer;
    }
    console.log(`i=${i}, j=${j}`);
  }
}

// labeled continue
search: for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) {
    if (j === 2) {
      continue search;
    }
    console.log(`search: i=${i}, j=${j}`);
  }
}

// with statement (deprecated but valid)
// const obj = { x: 1, y: 2 };
// with (obj) {
//   console.log(x + y); // 3
// }

// debugger statement
function debugExample(): void {
  let x = 1;
  debugger; // 调试器会在这里暂停
  x += 1;
  console.log(x);
}

// 复杂的循环控制
function complexLoop(): void {
  const matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ];
  
  let sum = 0;
  rowLoop: for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col] === 5) {
        console.log("Found 5, stopping");
        break rowLoop;
      }
      sum += matrix[row][col];
    }
  }
  console.log("Sum before 5:", sum); // 10 (1+2+3+4)
}

complexLoop();

// for-in 和 for-of
const obj = { a: 1, b: 2, c: 3 };
for (const key in obj) {
  console.log("Key:", key);
}

const arr = [10, 20, 30];
for (const value of arr) {
  console.log("Value:", value);
}

// 迭代器协议
const iterable = {
  *[Symbol.iterator]() {
    yield 1;
    yield 2;
    yield 3;
  }
};

for (const value of iterable) {
  console.log("Iterator value:", value);
}

// while 与 break/continue
let count = 0;
while (true) {
  count++;
  if (count === 3) continue;
  if (count > 5) break;
  console.log("Count:", count);
}

// do-while
let i = 0;
do {
  console.log("Do-while:", i);
  i++;
} while (i < 3);
