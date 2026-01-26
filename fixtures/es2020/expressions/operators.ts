// ES2020 operators
let a = 1;
let b = 2;
let c = 3;

const add = a + b;
const sub = a - b;
const mul = a * b;
const div = a / b;
const mod = a % b;
const pow = a ** b;

const bitAnd = a & b;
const bitOr = a | b;
const bitXor = a ^ b;
const shl = a << b;
const sar = a >> b;
const shr = a >>> b;

const lt = a < b;
const lte = a <= b;
const gt = a > b;
const gte = a >= b;
const eq = a == b;
const neq = a != b;
const seq = a === b;
const sneq = a !== b;

const inst = {} instanceof Object;
const isin = 'toString' in Object.prototype;

const neg = -a;
const pos = +a;
const not = ~a;
const lnot = !a;
const typ = typeof a;

let u = 0;
const preInc = ++u;
const postInc = u++;
const preDec = --u;
const postDec = u--;

const cond = a > b ? a : b;
const comma = (a++, b++, c);

let assign = 1;
assign += 2;
assign -= 1;
assign *= 2;
assign /= 2;
assign %= 2;
assign **= 2;
assign <<= 1;
assign >>= 1;
assign >>>= 1;
assign &= 1;
assign |= 1;
assign ^= 1;

void inst;
void isin;
void cond;
void comma;
