function outer() {
  let x = 10;
  function inner() {
    return x;
  }
  return inner();
}
outer();
