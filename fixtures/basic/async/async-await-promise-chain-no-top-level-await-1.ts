// 组合：async/await + promise chain (no top-level await)
async function run25() {
  const p = Promise.resolve(25);
  const a = await p;
  const b = await Promise.resolve(a + 1);
  return b * 2;
}
run25().then(v => console.log(v));
