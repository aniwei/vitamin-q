// ES2015+: for-of variations (let / identifier initializer)
const arr = [1, 2, 3]

let sum = 0
for (let x of arr) {
  sum += x
}
console.log(sum)

let y: any
for (y of arr) {
  if (y === 2) break
}
console.log(y)
