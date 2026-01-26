const complex = (x: number) => {
  const y = 10;
  if (x > y) {
    return x - y;
  }
  return y - x;
};
console.log(complex(5));
