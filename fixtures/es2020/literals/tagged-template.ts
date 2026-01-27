// ES2020 - 标签模板字面量
// Tagged Template Literals

// 基本标签模板
function tag(strings: TemplateStringsArray, ...values: any[]): string {
  console.log("Strings:", strings);
  console.log("Values:", values);
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? values[i] : "");
  }, "");
}

const name = "World";
const result = tag`Hello ${name}!`;
console.log(result);

// HTML 转义标签
function html(strings: TemplateStringsArray, ...values: any[]): string {
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };
  
  return strings.reduce((result, str, i) => {
    const value = values[i] !== undefined ? escapeHtml(String(values[i])) : "";
    return result + str + value;
  }, "");
}

const userInput = '<script>alert("xss")</script>';
const safeHtml = html`<div>${userInput}</div>`;
console.log(safeHtml); // <div>&lt;script&gt;...

// 高亮标签
function highlight(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((result, str, i) => {
    const value = values[i] !== undefined ? `**${values[i]}**` : "";
    return result + str + value;
  }, "");
}

const topic = "JavaScript";
const highlighted = highlight`Learn ${topic} today!`;
console.log(highlighted); // Learn **JavaScript** today!

// 国际化标签
const translations: Record<string, string> = {
  "Hello {0}!": "你好 {0}！",
  "Goodbye {0}!": "再见 {0}！"
};

function i18n(strings: TemplateStringsArray, ...values: any[]): string {
  const template = strings.join("{0}").replace(/\{0\}\{0\}/g, (_, i) => `{${i}}`);
  
  let i = 0;
  const key = strings.reduce((result, str, idx) => {
    return result + str + (values[idx] !== undefined ? `{${i++}}` : "");
  }, "");
  
  let translated = translations[key] || key;
  values.forEach((value, idx) => {
    translated = translated.replace(`{${idx}}`, String(value));
  });
  
  return translated;
}

// SQL 参数化查询标签
interface SQLQuery {
  text: string;
  values: any[];
}

function sql(strings: TemplateStringsArray, ...values: any[]): SQLQuery {
  let text = "";
  const params: any[] = [];
  
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  });
  
  return { text, values: params };
}

const userId = 42;
const userName = "Alice";
const query = sql`SELECT * FROM users WHERE id = ${userId} AND name = ${userName}`;
console.log(query);
// { text: "SELECT * FROM users WHERE id = $1 AND name = $2", values: [42, "Alice"] }

// 原始字符串标签
function raw(strings: TemplateStringsArray): string {
  return strings.raw.join("");
}

const rawString = raw`Line1\nLine2\tTabbed`;
console.log(rawString); // Line1\nLine2\tTabbed (不会解释转义)

// String.raw 内置标签
const path = String.raw`C:\Users\name\Documents`;
console.log(path); // C:\Users\name\Documents

// 缓存标签
const cache = new Map<string, string>();

function cached(strings: TemplateStringsArray, ...values: any[]): string {
  const key = strings.join("|||");
  
  if (cache.has(key)) {
    console.log("Cache hit!");
    let result = cache.get(key)!;
    values.forEach((v, i) => {
      result = result.replace(`{${i}}`, String(v));
    });
    return result;
  }
  
  const template = strings.reduce((acc, str, i) => {
    return acc + str + (i < values.length ? `{${i}}` : "");
  }, "");
  
  cache.set(key, template);
  
  let result = template;
  values.forEach((v, i) => {
    result = result.replace(`{${i}}`, String(v));
  });
  
  return result;
}

console.log(cached`Hello ${name}!`);
console.log(cached`Hello ${"Bob"}!`);
