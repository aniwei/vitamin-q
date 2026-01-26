// with + debugger (non-strict)
const obj: any = { a: 1 };
with (obj) {
  a = a + 1;
}

debugger;
