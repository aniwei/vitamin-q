// 组合：async/await + promise chain (no top-level await)
async function run6() {
  const p = Promise.resolve(6);
  const a = await p;
  const b = await Promise.resolve(a + 1);
  return b * 2;
}
run6().then(v => console.log(v));
