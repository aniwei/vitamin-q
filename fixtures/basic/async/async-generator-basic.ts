// ES2018+: async generators + for-await-of
async function* gen() {
  yield 1
  yield await Promise.resolve(2)
}

;(async () => {
  let sum = 0
  for await (const v of gen()) sum += v
  console.log(sum)
})()
