// try/catch/finally
try {
  throw new Error('x');
} catch (e) {
  void e;
} finally {
  void 0;
}

// optional catch binding (ES2019, included in ES2020)
try {
  throw 1;
} catch {
  void 0;
}
