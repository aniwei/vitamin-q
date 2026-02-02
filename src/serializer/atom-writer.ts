import { AtomTable } from '../atom/atom-table'
import type { JSAtom } from '../types/function-def'
import { bcPutU32, bcPutU8 } from './bytecode-writer'

export interface AtomWriteState {
  table: AtomTable
  idxToAtom: JSAtom[]
}

/**
 * Atom 序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:500-620
 */
export const createAtomWriteState = (table: AtomTable): AtomWriteState => ({
  table,
  idxToAtom: [],
})

/**
 * @source QuickJS/src/core/bytecode.cpp:520-560
 * @see bc_atom_to_idx
 */
export const bcAtomToIdx = (state: AtomWriteState, atom: JSAtom): number => {
  let idx = state.idxToAtom.indexOf(atom)
  if (idx === -1) {
    idx = state.idxToAtom.length
    state.idxToAtom.push(atom)
  }
  return idx
}

/**
 * @source QuickJS/src/core/bytecode.cpp:560-590
 * @see bc_put_atom
 */
export const bcPutAtom = (state: AtomWriteState, writer: { buf: number[] }, atom: JSAtom) => {
  bcPutU32(writer, bcAtomToIdx(state, atom))
}

/**
 * @source QuickJS/src/core/bytecode.cpp:590-620
 * @see JS_WriteObjectAtoms
 */
export const JS_WriteObjectAtoms = (state: AtomWriteState, writer: { buf: number[] }) => {
  const atoms = state.table.getAllAtoms()
  bcPutU32(writer, atoms.length)
  for (const atom of atoms) {
    const name = atom.name
    bcPutU32(writer, atom.id)
    bcPutU32(writer, name.length)
    for (const ch of name) {
      bcPutU8(writer, ch.charCodeAt(0))
    }
  }
}
