// ES2020 - String.prototype.matchAll
// 返回所有匹配结果的迭代器

// 基本使用
const text = "test1test2test3";
const regex = /test(\d)/g; // 必须有 g 标志

// matchAll 返回迭代器
const matches = text.matchAll(regex);

// 迭代所有匹配
for (const match of matches) {
  console.log("Full match:", match[0]);  // test1, test2, test3
  console.log("Group 1:", match[1]);     // 1, 2, 3
  console.log("Index:", match.index);    // 0, 5, 10
}

// 转换为数组
const allMatches = [...text.matchAll(regex)];
console.log("Total matches:", allMatches.length); // 3

// 与 String.match 的区别
const str = "The quick brown fox jumps";
const wordRegex = /\b(\w+)\b/g;

// match 只返回匹配的字符串
console.log(str.match(wordRegex)); // ["The", "quick", "brown", "fox", "jumps"]

// matchAll 返回完整的匹配信息
for (const m of str.matchAll(wordRegex)) {
  console.log(`Word: ${m[0]} at index ${m.index}`);
}

// 命名捕获组
const dateText = "Today is 2023-12-25 and tomorrow is 2023-12-26";
const dateRegex = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/g;

for (const match of dateText.matchAll(dateRegex)) {
  console.log("Date:", match[0]);
  console.log("Year:", match.groups?.year);
  console.log("Month:", match.groups?.month);
  console.log("Day:", match.groups?.day);
}

// 实际用例：解析模板字符串中的变量
const template = "Hello {{name}}, welcome to {{city}}!";
const varRegex = /\{\{(\w+)\}\}/g;

function extractVariables(tmpl: string): string[] {
  const vars: string[] = [];
  for (const match of tmpl.matchAll(varRegex)) {
    vars.push(match[1]);
  }
  return vars;
}

console.log(extractVariables(template)); // ["name", "city"]

// 解析 HTML 标签
const html = '<div class="container"><span id="title">Hello</span></div>';
const tagRegex = /<(\w+)([^>]*)>/g;

for (const match of html.matchAll(tagRegex)) {
  console.log("Tag:", match[1]);
  console.log("Attributes:", match[2].trim());
}

// 使用 Array.from 处理
const numbers = "a1b2c3d4e5";
const numRegex = /(\d)/g;

const digits = Array.from(numbers.matchAll(numRegex), m => parseInt(m[1], 10));
console.log("Digits:", digits); // [1, 2, 3, 4, 5]
console.log("Sum:", digits.reduce((a, b) => a + b, 0)); // 15

// 复杂正则表达式
const logLine = '[2023-12-25 10:30:45] ERROR: Connection failed (timeout=30s)';
const logRegex = /\[(?<date>[\d-]+)\s+(?<time>[\d:]+)\]\s+(?<level>\w+):\s+(?<message>.+)/g;

for (const match of logLine.matchAll(logRegex)) {
  console.log("Log entry:", {
    date: match.groups?.date,
    time: match.groups?.time,
    level: match.groups?.level,
    message: match.groups?.message,
  });
}
