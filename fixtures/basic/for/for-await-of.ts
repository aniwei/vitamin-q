async function* numbers() {
  yield 1
  yield 2
  yield 3
}

async function main() {
  let sum = 0
  for await (const n of numbers()) {
    sum += n
  }
  console.log('sum', sum)
}

main()
