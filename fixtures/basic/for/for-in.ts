const obj = { a: 1, b: 2, c: 3 }

let sum = 0
for (const k in obj) {
  if (k === 'b') continue
  sum += (obj as any)[k]
}

sum
