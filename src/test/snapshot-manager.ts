import fs from 'node:fs'
import path from 'node:path'

const SNAPSHOT_ROOT = path.resolve(process.cwd(), 'artifacts/bytecode')

export const getSnapshotPath = (fixturePath: string): string => {
  const rel = path.relative(process.cwd(), fixturePath).replace(/[\\/]/g, '__')
  return path.join(SNAPSHOT_ROOT, `${rel}.bin`)
}

export const loadSnapshot = (fixturePath: string): Uint8Array | null => {
  const filePath = getSnapshotPath(fixturePath)
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath)
}

export const saveSnapshot = (fixturePath: string, bytes: Uint8Array): void => {
  const filePath = getSnapshotPath(fixturePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, bytes)
}

export const compareSnapshot = (fixturePath: string, bytes: Uint8Array): boolean => {
  const snapshot = loadSnapshot(fixturePath)
  if (!snapshot) return false
  if (snapshot.length !== bytes.length) return false
  for (let i = 0; i < bytes.length; i += 1) {
    if (snapshot[i] !== bytes[i]) return false
  }
  return true
}
