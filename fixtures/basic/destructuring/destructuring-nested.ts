// ES2015+: object destructuring (rename + defaults)
const obj: any = { a: 1, b: 2, c: undefined }
const { a: x, b: y, c: z = 3 } = obj

console.log(x, y, z)
