// ES2020 - 正则表达式高级特性
// Regular Expression Advanced Features

// 命名捕获组 (Named Capture Groups)
const dateRegex = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const dateMatch = "2023-12-25".match(dateRegex);

if (dateMatch && dateMatch.groups) {
  console.log("Year:", dateMatch.groups.year);
  console.log("Month:", dateMatch.groups.month);
  console.log("Day:", dateMatch.groups.day);
}

// 命名后向引用
const repeatRegex = /(?<word>\w+)\s+\k<word>/;
console.log(repeatRegex.test("hello hello"));  // true
console.log(repeatRegex.test("hello world"));  // false

// 前瞻断言 (Lookahead)
const positiveLookahead = /\d+(?=px)/;
console.log("100px".match(positiveLookahead)?.[0]); // "100"
console.log("100em".match(positiveLookahead));      // null

const negativeLookahead = /\d+(?!px)/;
console.log("100em".match(negativeLookahead)?.[0]); // "100"

// 后顾断言 (Lookbehind) - ES2018
const positiveLookbehind = /(?<=\$)\d+/;
console.log("$100".match(positiveLookbehind)?.[0]); // "100"
console.log("€100".match(positiveLookbehind));      // null

const negativeLookbehind = /(?<!\$)\d+/;
console.log("€100".match(negativeLookbehind)?.[0]); // "100"

// Unicode 属性转义 (Unicode Property Escapes)
const unicodeLetterRegex = /\p{Letter}/u;
console.log(unicodeLetterRegex.test("a"));   // true
console.log(unicodeLetterRegex.test("中"));  // true
console.log(unicodeLetterRegex.test("1"));   // false

const emojiRegex = /\p{Emoji}/u;
console.log(emojiRegex.test("😀")); // true
console.log(emojiRegex.test("a"));  // false

// s 标志 (dotAll mode)
const multilineRegex = /hello.world/s;
console.log(multilineRegex.test("hello\nworld")); // true

const withoutS = /hello.world/;
console.log(withoutS.test("hello\nworld")); // false

// 粘性标志 (sticky flag)
const stickyRegex = /foo/y;
stickyRegex.lastIndex = 3;
console.log(stickyRegex.test("xxxfoo")); // true
console.log(stickyRegex.lastIndex);      // 6

// 组合使用
const complexRegex = /(?<protocol>https?):\/\/(?<host>[\w.-]+)(?<path>\/[^\s]*)?/giu;
const url = "Visit HTTPS://Example.COM/path for more info";

for (const match of url.matchAll(complexRegex)) {
  console.log("Protocol:", match.groups?.protocol);
  console.log("Host:", match.groups?.host);
  console.log("Path:", match.groups?.path);
}

// 替换中使用命名捕获组
const nameSwap = /(?<first>\w+)\s+(?<last>\w+)/;
const swapped = "John Doe".replace(nameSwap, "$<last>, $<first>");
console.log(swapped); // "Doe, John"

// 函数替换
const emphasized = "Hello World".replace(
  /(\w+)/g,
  (match, word) => `*${word}*`
);
console.log(emphasized); // "*Hello* *World*"

// 复杂匹配示例
const logPattern = /^\[(?<level>\w+)\]\s+(?<timestamp>[\d:.-T]+)\s+(?<message>.+)$/;
const logLine = "[ERROR] 2023-12-25T10:30:00 Connection failed";
const logMatch = logLine.match(logPattern);

if (logMatch?.groups) {
  console.log({
    level: logMatch.groups.level,
    timestamp: logMatch.groups.timestamp,
    message: logMatch.groups.message,
  });
}
