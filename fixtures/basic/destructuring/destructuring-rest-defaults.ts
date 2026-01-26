// ES2018+: object destructuring with defaults + rest
const src: any = { a: 1, b: undefined, c: 3, d: 4 }
const { a, b = 2, ...rest } = src

console.log(a, b)
console.log(rest.c + rest.d)
