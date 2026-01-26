// 组合：computed property + object spread + method
const k = 'k' + (8%3);
const a = { [k]: 8, x: 1 };
const b = { ...a, y: 2, m(z) { return (this[k] ?? 0) + z; } };
console.log(b.m(5), b.x, b.y);
