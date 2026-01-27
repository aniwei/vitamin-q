// ES2020 - 可选链与空值合并组合
// 测试 ?. 和 ?? 的组合使用

interface User {
  name: string;
  address?: {
    city?: string;
    zip?: string;
    country?: {
      code?: string;
      name?: string;
    };
  };
  settings?: {
    theme?: string;
    notifications?: boolean;
  };
  getEmail?: () => string;
}

const user1: User = {
  name: "Alice",
  address: {
    city: "New York",
    country: {
      code: "US"
    }
  }
};

const user2: User = {
  name: "Bob"
};

// 可选链 + 空值合并
console.log(user1.address?.city ?? "Unknown");          // "New York"
console.log(user2.address?.city ?? "Unknown");          // "Unknown"

console.log(user1.address?.country?.code ?? "N/A");     // "US"
console.log(user1.address?.country?.name ?? "N/A");     // "N/A"
console.log(user2.address?.country?.code ?? "N/A");     // "N/A"

// 深层嵌套
const getCountryName = (u: User): string =>
  u.address?.country?.name ?? u.address?.country?.code ?? "Unknown Location";

console.log(getCountryName(user1));  // "US"
console.log(getCountryName(user2));  // "Unknown Location"

// 可选方法调用
console.log(user1.getEmail?.() ?? "no email");  // "no email"

// 带 ?? 的赋值
let theme: string;
theme = user1.settings?.theme ?? "light";
console.log(theme);  // "light"

// 数组索引的可选链
const arrays: { items?: number[] } = { items: [1, 2, 3] };
const empty: { items?: number[] } = {};

console.log(arrays.items?.[0] ?? 0);   // 1
console.log(arrays.items?.[10] ?? 0);  // 0
console.log(empty.items?.[0] ?? 0);    // 0

// 复杂表达式
const config = {
  api: {
    endpoints: {
      users: "/api/users"
    }
  }
};

const missing: { api?: any } = {};

const getUsersEndpoint = (c: any): string =>
  c?.api?.endpoints?.users ?? "/default/users";

console.log(getUsersEndpoint(config));    // "/api/users"
console.log(getUsersEndpoint(missing));   // "/default/users"
console.log(getUsersEndpoint(null));      // "/default/users"
console.log(getUsersEndpoint(undefined)); // "/default/users"
