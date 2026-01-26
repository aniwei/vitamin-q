async function fetchValue() {
  return 42
}

async function run() {
  const value = await fetchValue()
  console.log('value', value)
  return value + 1
}

run().then((next) => console.log('next', next))
