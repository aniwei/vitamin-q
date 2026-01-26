// ES2020 optional chaining
const obj: any = { a: { b: () => 1 }, arr: [1, 2] };
const r1 = obj?.a?.b?.();
const r2 = obj?.arr?.[0];
const r3 = obj?.missing?.x;
void r1;
void r2;
void r3;
